import datetime as dt
import time
import os
import logging
import pandas as pd
import mediacloud.api
from dotenv import load_dotenv

load_dotenv()  # reads variables from a .env file and sets them in os.environ

MC_API_KEY = os.getenv('MC_API_KEY')
if not MC_API_KEY:
    raise EnvironmentError("MC_API_KEY environment variable is not set")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Starting generation")

# give each of the lists a variable 
collections = [
    dict(name='far-left', cid=231013063), # mostly democrat
    dict(name='center-left', cid=231013089), # somewhat democrat
    dict(name='center', cid=231013108), # even
    dict(name='center-right', cid=231013109), # somewhat republican
    dict(name='far-right', cid=231013110), # mostly republican
]

# get top words for each side
search_api = mediacloud.api.SearchApi(os.getenv('MC_API_KEY'))
search_api.TIMEOUT_SECS = 120
query = "* and language:en"

def find_last_monday(d: dt.date = dt.date.today()) -> dt.date:
    days_behind = d.weekday()
    return d - dt.timedelta(days=days_behind)

OLDEST_DATA_DATE = dt.date(2023,1,1)
DATA_FIELD_NAMES=['term', 'count'] # the cols to save in the CSV for each week

def more_recent_than_oldest_data(date_to_check: dt.date) -> bool:
    return date_to_check > OLDEST_DATA_DATE

logger.info("Generating CSV files:")
start_date = find_last_monday() - dt.timedelta(days=7) # start with last week
more_weeks_to_do = True
while more_recent_than_oldest_data(start_date):
    end_date = start_date + dt.timedelta(days=6)
    logger.info("  {} to {}".format(start_date, end_date))
    for collection in collections:
        file_name = os.path.join("data", f"{start_date.strftime('%Y%m%d')}-{collection['name']}.csv")
        if os.path.exists(file_name):
            logger.info(f"    {collection['name']} exists already, skipping")
            start_date -= dt.timedelta(days=7)
            continue
        logger.info(f"    {collection['name']} fetching & saving data")
        results = search_api.words(query, start_date, end_date, collection_ids=[collection['cid']])
        pd.DataFrame(results).to_csv(file_name, index=False)
        time.sleep(0.1)
    time.sleep(0.5)

# print final message
logger.info("Finished generating CSV files.")
