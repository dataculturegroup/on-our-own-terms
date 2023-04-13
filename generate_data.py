import datetime as dt
import csv
import os
import logging
import mcmetadata
from waybacknews.searchapi import SearchApiClient
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Starting generation")

# these quintiles contain name of media sources across spectrum
# source: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/OZIVGB
collection_source_files = [
    "2018-quintiles/quintile-far-left.csv",
    "2018-quintiles/quintile-center-left.csv",
    "2018-quintiles/quintile-center.csv",
    "2018-quintiles/quintile-center-right.csv",
    "2018-quintiles/quintile-far-right.csv",
]

logger.info("Loading collections:")
# we are gathering domain names for the articles in each group above 
for c in collection_source_files:
    df = pd.read_csv(os.path.join("data", c))
    df = df[df['Include as News? (Y/N)']=='y']
    source_sites = list(df['domain'])
    domains = [mcmetadata.urls.canonical_domain(u) for u in source_sites]
    domains = [d for d in domains if len(d) > 0]
    logger.info("  {} - {} sources".format(c, len(domains)))
    with open(os.path.join("data", c[:-4]+".txt"), 'w') as f:
        for d in set(domains):
            f.write(d+"\n")
            
# creating a list of domains within each of the 5 quintiles 
domain_source_files = [f[:-4]+".txt" for f in collection_source_files]
domains_by_file = {}
for f in domain_source_files:
    with open(os.path.join("data",f)) as file:
        domains_by_file[f] = [l.strip() for l in file.readlines()] 
        
# print out dupes
# for each duplicated domain, put them in duplicated_domains list 
duplicated_domains = []
for file, domains in domains_by_file.items():
    for file2, domains2 in domains_by_file.items():
        if file != file2:
            for d in domains:
                if (d not in duplicated_domains) and (d in domains2):
                    logger.warning("  {} in both {} and {}".format(d, file, file2))
                    duplicated_domains.append(d)

# give each of the lists a variable 
far_left_domains = set(domains_by_file['2018-quintiles/quintile-far-left.txt'])
left_domains = set(domains_by_file['2018-quintiles/quintile-center-left.txt'] + list(far_left_domains))
far_right_domains = set(domains_by_file['2018-quintiles/quintile-far-right.txt'])
right_domains = set(domains_by_file['2018-quintiles/quintile-center-right.txt'] + list(far_right_domains))

# get top words for each side 
wm_api = SearchApiClient('mediacloud')
query = "*"
# gathering domains in the entered start/end dates, counting how many domains in left/right 
left_query = "{} AND domain:({})".format(query, " OR ".join(left_domains))
right_query = "{} AND domain:({})".format(query, " OR ".join(right_domains))

def find_last_monday(d: dt.date = dt.date.today()) -> dt.date:
    days_behind = d.weekday()
    return d - dt.timedelta(days=days_behind)

OLDEST_DATA_DATE = dt.date(2022,7,31)
DATA_FIELD_NAMES=['term', 'count'] # the cols to save in the CSV for each week

def more_recent_than_oldest_data(date_to_check: dt.date) -> bool:
    return date_to_check > OLDEST_DATA_DATE

def valid_term(candidate_term: str) -> bool:
    return (candidate_term not in stop_words) and (len(candidate_term) > 3) and (not candidate_term.isnumeric())

# getting list of stop words (custom built by Media Cloud project)
with open(os.path.join("data", "en_stop_words.txt")) as f:
    stop_words = [l.strip() for l in f.readlines() if len(l.strip())>0 and l[0] != "#"]

logger.info("Generating CSV files:")
start_date = find_last_monday() - dt.timedelta(days=7) # start with last week
more_weeks_to_do = True
while more_recent_than_oldest_data(start_date):
    end_date = start_date + dt.timedelta(days=6)
    left_file_name = os.path.join("data", "{}-top-left.csv".format(start_date.strftime('%Y%m%d')))
    right_file_name = os.path.join("data", "{}-top-right.csv".format(start_date.strftime('%Y%m%d')))
    logger.info("  {} to {}".format(start_date, end_date))
    if os.path.exists(left_file_name) or os.path.exists(right_file_name):
        logger.info("  exists already, skipping")
        start_date -= dt.timedelta(days=7)
        continue
    logger.info("    fetching data")

    # get top terms from each siede
    left_terms = wm_api.terms(left_query, start_date, end_date, wm_api.TERM_FIELD_TITLE, wm_api.TERM_AGGREGATION_TOP)
    left_terms = {term:count for term, count in left_terms.items() if valid_term(term)}
    right_terms = wm_api.terms(right_query, start_date, end_date, wm_api.TERM_FIELD_TITLE, wm_api.TERM_AGGREGATION_TOP)
    right_terms = {term:count for term, count in right_terms.items() if valid_term(term)}
    
    max_freq = max(list(left_terms.values()) + list(right_terms.values()))

    # save data to static files for quicker loading and rendering in UI
    left_csv_data = []
    for key, value in left_terms.items():
        left_csv_data.append([key,value])
    with open(left_file_name, "w") as f:
        left_csv = csv.writer(f)
        left_csv.writerow(DATA_FIELD_NAMES)
        for row in left_csv_data:
            left_csv.writerow(row)
    right_csv_data = []
    for key, value in right_terms.items():
        right_csv_data.append([key,value])
    with open(right_file_name, "w") as f:
        right_csv = csv.writer(f)
        right_csv.writerow(DATA_FIELD_NAMES)
        for row in right_csv_data:
            right_csv.writerow(row)
    
    logger.info("    saved")

    start_date -= dt.timedelta(days=7)

# print final message
logger.info("Finished generating CSV files.")
