#!/usr/bin/env python3
"""
Analyze partisan distribution of high-frequency terms in US politics weekly data.
Finds terms that appear frequently AND show strong partisan skew across 5 quintiles.
"""

import os
import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path("/Users/r.bhargava/Documents/northeastern/projects/media-cloud/us-politics-weekly-terms/data-terms")
TOP_TERMS_CSV = DATA_DIR / "top-terms.csv"

COLLECTIONS = ["far-left", "center-left", "center", "center-right", "far-right"]
COL_ABBREV = {
    "far-left": "fl",
    "center-left": "cl",
    "center": "c",
    "center-right": "cr",
    "far-right": "fr",
}

MIN_WEEKS = 100  # minimum weeks mentioned to qualify
TOP_N_TERMS = 150  # how many top terms to consider from the list
TOP_N_RESULTS = 40  # how many results to return


def load_top_terms(n=TOP_N_TERMS, min_weeks=MIN_WEEKS):
    df = pd.read_csv(TOP_TERMS_CSV)
    df = df.sort_values("weeks_mentioned", ascending=False)
    # apply both: take top N AND require min_weeks
    df = df[df["weeks_mentioned"] >= min_weeks].head(n)
    print(f"Loaded {len(df)} terms with >= {min_weeks} weeks mentioned (top {n} cap)")
    return df


def load_term_data(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return None
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    # ensure date is string-comparable
    df["date"] = df["date"].astype(str)
    return df


def compute_avg_ratios(df):
    """
    For each week (date), check if ALL 5 collections have zero doc_ratio.
    If so, drop that week. Otherwise compute per-collection average doc_ratio
    across the remaining weeks.
    """
    # pivot: rows=date, cols=collection, values=doc_ratio
    pivot = df.pivot_table(index="date", columns="collection", values="doc_ratio", aggfunc="mean")
    # ensure all 5 collections present
    for col in COLLECTIONS:
        if col not in pivot.columns:
            pivot[col] = 0.0
    pivot = pivot[COLLECTIONS]

    # drop weeks where ALL collections are zero
    all_zero_mask = (pivot == 0).all(axis=1)
    pivot_filtered = pivot[~all_zero_mask]

    n_active_weeks = len(pivot_filtered)
    if n_active_weeks == 0:
        return None, 0

    avg = pivot_filtered.mean(axis=0)
    return avg, n_active_weeks


def partisan_score(avg_ratios):
    """
    Computes several partisan metrics:

    1. extreme_vs_center: (far-left + far-right) / (center-left + center + center-right)
       High = word lives at the extremes, not the center.

    2. std_score: std deviation across 5 quintile averages (normalized by mean).
       High = uneven distribution.

    3. max_to_min: max quintile ratio / min quintile ratio (where min > 0).
       High = one quintile dominates.

    We use a composite: primarily std_score (captures variance across all 5),
    but report all three. We also flag extreme_vs_center separately.
    """
    fl = avg_ratios["far-left"]
    cl = avg_ratios["center-left"]
    c  = avg_ratios["center"]
    cr = avg_ratios["center-right"]
    fr = avg_ratios["far-right"]

    values = np.array([fl, cl, c, cr, fr])
    mean_val = values.mean()

    # coefficient of variation (std / mean) — scale-independent
    cv = values.std() / mean_val if mean_val > 0 else 0.0

    # extreme vs center
    center_sum = cl + c + cr
    extreme_sum = fl + fr
    extreme_ratio = extreme_sum / center_sum if center_sum > 0 else (extreme_sum * 999)

    # max-to-min
    nonzero = values[values > 0]
    max_min = nonzero.max() / nonzero.min() if len(nonzero) >= 2 else 1.0

    # composite partisan score: weight CV heavily, nudge with extreme_ratio
    # both normalized so they're roughly comparable
    composite = cv  # primary metric; we'll sort by this

    return {
        "partisan_score": round(composite, 4),
        "cv": round(cv, 4),
        "extreme_ratio": round(extreme_ratio, 4),
        "max_min_ratio": round(max_min, 2),
    }


def lean_direction(avg_ratios):
    """
    Determines political lean:
    - left_score  = far-left + center-left
    - right_score = center-right + far-right
    - extreme_score = far-left + far-right
    - center_score = center-left + center + center-right

    Labels:
      extreme-both  : extreme_ratio > 1.5 AND left/right roughly balanced (within 30%)
      extreme-left  : extreme-left dominant
      extreme-right : extreme-right dominant
      left          : left_score > right_score * 1.3 and not extreme-driven
      right         : right_score > left_score * 1.3 and not extreme-driven
      balanced      : otherwise
    """
    fl = avg_ratios["far-left"]
    cl = avg_ratios["center-left"]
    c  = avg_ratios["center"]
    cr = avg_ratios["center-right"]
    fr = avg_ratios["far-right"]

    left_score  = fl + cl
    right_score = cr + fr
    center_sum  = cl + c + cr
    extreme_sum = fl + fr

    extreme_ratio = extreme_sum / center_sum if center_sum > 0 else 999

    # is it extreme-driven?
    if extreme_ratio > 1.2:
        # distinguish which extreme dominates
        if fl > fr * 1.5:
            return "extreme-left"
        elif fr > fl * 1.5:
            return "extreme-right"
        else:
            return "extreme-both"

    # standard left/right lean
    if left_score > right_score * 1.4:
        return "left"
    elif right_score > left_score * 1.4:
        return "right"
    elif left_score > right_score * 1.1:
        return "left-lean"
    elif right_score > left_score * 1.1:
        return "right-lean"
    else:
        return "balanced"


def main():
    top_terms = load_top_terms()

    results = []
    skipped = 0

    for _, row in top_terms.iterrows():
        term = row["term"]
        weeks_mentioned = row["weeks_mentioned"]
        filename = row["filename"]

        df = load_term_data(filename)
        if df is None:
            skipped += 1
            continue

        avg_ratios, n_active = compute_avg_ratios(df)
        if avg_ratios is None or n_active < 5:
            skipped += 1
            continue

        scores = partisan_score(avg_ratios)
        lean = lean_direction(avg_ratios)

        results.append({
            "term": term,
            "weeks_mentioned": weeks_mentioned,
            "active_weeks": n_active,
            "partisan_score": scores["partisan_score"],
            "cv": scores["cv"],
            "extreme_ratio": scores["extreme_ratio"],
            "max_min_ratio": scores["max_min_ratio"],
            "lean": lean,
            "avg_far-left":     round(avg_ratios["far-left"], 5),
            "avg_center-left":  round(avg_ratios["center-left"], 5),
            "avg_center":       round(avg_ratios["center"], 5),
            "avg_center-right": round(avg_ratios["center-right"], 5),
            "avg_far-right":    round(avg_ratios["far-right"], 5),
        })

    print(f"Processed {len(results)} terms, skipped {skipped}\n")

    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values("partisan_score", ascending=False)

    top_results = results_df.head(TOP_N_RESULTS)

    # ---- Pretty print ----
    pd.set_option("display.max_rows", 60)
    pd.set_option("display.max_columns", 20)
    pd.set_option("display.width", 160)
    pd.set_option("display.float_format", "{:.5f}".format)

    print("=" * 160)
    print(f"TOP {TOP_N_RESULTS} MOST PARTISAN HIGH-FREQUENCY TERMS")
    print("(sorted by coefficient of variation across 5 quintile avg doc_ratios)")
    print("=" * 160)

    display_df = top_results[[
        "term", "weeks_mentioned", "active_weeks",
        "partisan_score", "extreme_ratio", "max_min_ratio",
        "avg_far-left", "avg_center-left", "avg_center", "avg_center-right", "avg_far-right",
        "lean"
    ]].reset_index(drop=True)
    display_df.index += 1  # 1-based rank

    print(display_df.to_string())

    print("\n")
    print("=" * 160)
    print("BREAKDOWN BY LEAN CATEGORY")
    print("=" * 160)
    lean_counts = top_results["lean"].value_counts()
    print(lean_counts.to_string())

    print("\n")
    print("=" * 160)
    print("NOTABLE FINDINGS — TOP 10 EXTREME-BOTH (polarizing across left AND right extremes)")
    print("=" * 160)
    extreme_both = results_df[results_df["lean"].isin(["extreme-both", "extreme-left", "extreme-right"])].head(10)
    print(extreme_both[[
        "term", "weeks_mentioned", "partisan_score", "extreme_ratio",
        "avg_far-left", "avg_center-left", "avg_center", "avg_center-right", "avg_far-right",
        "lean"
    ]].reset_index(drop=True).to_string())

    print("\n")
    print("=" * 160)
    print("NOTABLE FINDINGS — TOP 10 STRONGLY LEFT-LEANING TERMS")
    print("=" * 160)
    left_terms = results_df[results_df["lean"].isin(["left", "left-lean", "extreme-left"])].head(10)
    print(left_terms[[
        "term", "weeks_mentioned", "partisan_score", "extreme_ratio",
        "avg_far-left", "avg_center-left", "avg_center", "avg_center-right", "avg_far-right",
        "lean"
    ]].reset_index(drop=True).to_string())

    print("\n")
    print("=" * 160)
    print("NOTABLE FINDINGS — TOP 10 STRONGLY RIGHT-LEANING TERMS")
    print("=" * 160)
    right_terms = results_df[results_df["lean"].isin(["right", "right-lean", "extreme-right"])].head(10)
    print(right_terms[[
        "term", "weeks_mentioned", "partisan_score", "extreme_ratio",
        "avg_far-left", "avg_center-left", "avg_center", "avg_center-right", "avg_far-right",
        "lean"
    ]].reset_index(drop=True).to_string())

    # save full results
    out_path = "/Users/r.bhargava/Documents/northeastern/projects/media-cloud/us-politics-weekly-terms/partisan_terms_analysis.csv"
    results_df.to_csv(out_path, index=False)
    print(f"\nFull results saved to: {out_path}")


if __name__ == "__main__":
    main()
