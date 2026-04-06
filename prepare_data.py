import os
import re
import csv
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'data-terms')
WEEK_THRESHOLD = 8  # term must appear in more than this many distinct weeks

COLLECTIONS = ['far-left', 'center-left', 'center', 'center-right', 'far-right']
TERM_COUNT = 400

def parse_filename(filename):
    """Return (date_str, collection) from a filename like '20250421-center-left.csv', or (None, None)."""
    basename = filename.removesuffix('.csv')
    match = re.match(r'^(\d{8})-(.+)$', basename)
    if match:
        return match.group(1), match.group(2)
    return None, None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # term -> set of distinct weeks (dates) it appeared in (across all collections)
    term_weeks: dict[str, set] = defaultdict(set)
    # term -> list of row dicts with all metric fields
    term_data: dict[str, list] = defaultdict(list)
    all_dates: set = set()

    for filename in sorted(os.listdir(DATA_DIR)):
        if not filename.endswith('.csv'):
            continue
        date, collection = parse_filename(filename)
        if date is None or collection not in COLLECTIONS:
            continue

        all_dates.add(date)
        filepath = os.path.join(DATA_DIR, filename)

        with open(filepath, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                term = row['term']
                term_weeks[term].add(date)
                term_data[term].append({
                    'date': date,
                    'collection': collection,
                    'term_count': row['term_count'],
                    'term_ratio': row['term_ratio'],
                    'doc_count': row['doc_count'],
                    'doc_ratio': row['doc_ratio'],
                    'sample_size': row['sample_size'],
                })

    all_dates_sorted = sorted(all_dates)

    # Only keep terms that appear in more than WEEK_THRESHOLD distinct weeks
    qualifying_terms = {
        term for term, weeks in term_weeks.items() if len(weeks) > WEEK_THRESHOLD
    }
    print(f"Found {len(qualifying_terms)} qualifying terms (appeared in > {WEEK_THRESHOLD} weeks)")

    ZERO_ROW = {
        'term_count': 0,
        'term_ratio': 0,
        'doc_count': 0,
        'doc_ratio': 0,
        'sample_size': 0,
    }

    for term in sorted(qualifying_terms):
        # Build a fast lookup: (date, collection) -> metric dict
        lookup: dict[tuple, dict] = {}
        for entry in term_data[term]:
            lookup[(entry['date'], entry['collection'])] = entry

        # One row per (date, collection), zeros where the term wasn't present
        rows = []
        for date in all_dates_sorted:
            for collection in COLLECTIONS:
                entry = lookup.get((date, collection), ZERO_ROW)
                rows.append({
                    'date': date,
                    'collection': collection,
                    'term_count': entry['term_count'],
                    'term_ratio': entry['term_ratio'],
                    'doc_count': entry['doc_count'],
                    'doc_ratio': entry['doc_ratio'],
                    'sample_size': entry['sample_size'],
                })

        # Sanitise term for use as a filename
        safe_term = re.sub(r'[^\w\-]', '-', term)
        output_path = os.path.join(OUTPUT_DIR, f"{safe_term}-historical.csv")

        fieldnames = ['date', 'collection', 'term_count', 'term_ratio',
                      'doc_count', 'doc_ratio', 'sample_size']
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print(f"Saved {len(qualifying_terms)} term files to '{OUTPUT_DIR}/'")

    # Write top-terms.csv: top 100 terms by number of distinct weeks mentioned
    top_terms = sorted(term_weeks.items(), key=lambda x: len(x[1]), reverse=True)[:TERM_COUNT]
    top_terms_path = os.path.join(OUTPUT_DIR, 'top-terms.csv')
    with open(top_terms_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['term', 'weeks_mentioned', 'filename'])
        writer.writeheader()
        for term, weeks in top_terms:
            safe_term = re.sub(r'[^\w\-]', '-', term)
            writer.writerow({
                'term': term,
                'weeks_mentioned': len(weeks),
                'filename': f"{safe_term}-historical.csv",
            })
    print(f"Saved top-terms.csv with {len(top_terms)} terms to '{OUTPUT_DIR}/'")

    # Print the max combined doc_ratio across all collections for a single week, per term
    print("\nMax combined doc_ratio (sum of all 5 collections in one week) per term:")
    top_term_names = {t for t, _ in top_terms}
    max_overall = 0
    max_overall_term = None
    max_overall_date = None
    for term in sorted(top_term_names):
        # group entries by date, sum doc_ratio across collections
        weekly_totals: dict[str, float] = defaultdict(float)
        for entry in term_data[term]:
            weekly_totals[entry['date']] += float(entry['doc_ratio'])
        peak_date = max(weekly_totals, key=weekly_totals.get)
        peak_val = weekly_totals[peak_date]
        if peak_val > max_overall:
            max_overall = peak_val
            max_overall_term = term
            max_overall_date = peak_date
        print(f"  {term:20s}  {peak_val:.4f}  (week {peak_date})")
    print(f"\n>>> Global max: \"{max_overall_term}\" = {max_overall:.4f} (week {max_overall_date})")


if __name__ == '__main__':
    main()

