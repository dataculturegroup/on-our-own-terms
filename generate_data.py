import mcmetadata
from waybacknews.searchapi import SearchApiClient
import pandas as pd
import datetime as dt
import csv
import os
from collections import Counter
import requests
import altair as alt
import spacy
import json
from IPython.display import JSON
from wordcloud import WordCloud
import matplotlib.pyplot as plt
from github import Github

# extract domains from collections 

# https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/OZIVGB
# quintiles contain name of articles 
collection_source_files = [
    "2018-quintiles/quintile-far-left.csv",
    "2018-quintiles/quintile-center-left.csv",
    "2018-quintiles/quintile-center.csv",
    "2018-quintiles/quintile-center-right.csv",
    "2018-quintiles/quintile-far-right.csv",
]

# we are gathering domain names for the articles in each group above 
for c in collection_source_files:
    df = pd.read_csv(os.path.join("data", c))
    df = df[df['Include as News? (Y/N)']=='y']
    source_sites = list(df['domain'])
    domains = [mcmetadata.urls.canonical_domain(u) for u in source_sites]
    domains = [d for d in domains if len(d) > 0]
    with open(os.path.join("data", c[:-4]+".txt"), 'w') as f:
        for d in set(domains):
            f.write(d+"\n")
            
# creating a list of articles within each of the 5 quintiles 
domain_source_files = [f[:-4]+".txt" for f in collection_source_files]
domains_by_file = {}
for f in domain_source_files:
    with open(os.path.join("data",f)) as file:
        domains_by_file[f] = [l.strip() for l in file.readlines()] 
        
# print out dupes
# for each duplicated article, put them in duplicated_domains list 
duplicated_domains = []
for file, domains in domains_by_file.items():
    for file2, domains2 in domains_by_file.items():
        if file != file2:
            for d in domains:
                if (d not in duplicated_domains) and (d in domains2):
                    #print("{} in both {} and {}".format(d, file, file2))
                    duplicated_domains.append(d)
                    
# give each of the lists a variable 
far_left_domains = set(domains_by_file['2018-quintiles/quintile-far-left.txt'])
left_domains = set(domains_by_file['2018-quintiles/quintile-center-left.txt'] + list(far_left_domains))
far_right_domains = set(domains_by_file['2018-quintiles/quintile-far-right.txt'])
right_domains = set(domains_by_file['2018-quintiles/quintile-center-right.txt'] + list(far_right_domains))

# get top words for each side 
client = SearchApiClient('mediacloud')
query = "*"

start = dt.date(2022,11,10) # dt.date.today() - timedelta(days=2)
end = dt.date(2022,11,17) # dt.date.today() - timedelta(days=1)

# gathering domains in the entered start/end dates, counting how many domains in left/right 
left_query = "{} AND domain:({})".format(query, " OR ".join(left_domains))
client.count(left_query, start, end)

right_query = "{} AND domain:({})".format(query, " OR ".join(right_domains))
client.count(right_query, start, end)

# counting occurrence of each term in article list for right/left if word is not stop word, not number, longer than 3 letters 
left_terms = client.terms(left_query, start, end, 'title', 'top')
left_terms = {term:count for term, count in left_terms.items() if term not in stop_words and len(term) > 3 and not term.isnumeric()}
right_terms = client.terms(right_query, start, end, 'title', 'top')
right_terms = {term:count for term, count in right_terms.items() if term not in stop_words and len(term) > 3 and not term.isnumeric()}
max_freq = max(list(left_terms.values()) + list(right_terms.values()))

fieldnames=['term', 'count']
with open('left-top-terms.csv','w') as csvfile:
    writer=csv.writer(csvfile)
    writer.writerow(fieldnames)
    for key, value in left_terms.items():
        writer.writerow([key,value]) 
with open('right-top-terms.csv','w') as csvfile:
    writer=csv.writer(csvfile)
    writer.writerow(fieldnames)
    for key, value in right_terms.items():
        writer.writerow([key,value])
        
results = []
for page in client.all_articles(left_query, start, end):
    results += page
    print('page of {}'.format(len(page)))
df = pd.DataFrame(results)
df.to_csv('left-stories.csv')

corpus = " ".join(set(df['title']))

nlp = spacy.load("en_core_web_sm")
nlp.max_length = len(corpus)+100
doc = nlp(corpus)
# all tokens that arent stop words or punctuations
words = [token.text
         for token in doc
         if not token.is_stop and not token.is_punct]

# noun tokens that arent stop words or punctuations
nouns = [token.text
         for token in doc
         if (not token.is_stop and
             not token.is_punct and
             token.pos_ == "NOUN")]

# five most common tokens
word_freq = Counter(words)
word_freq.most_common(20)

with open('top-terms.csv','w') as csvfile:
    fieldnames=['term', 'count']
    writer=csv.writer(csvfile)
    writer.writerow(fieldnames)
    for key, value in word_freq.items():
        writer.writerow([key,value]) 

client = SearchApiClient('mediacloud')
query = "*"
span_start = dt.date(2022,7,31)
span_end = dt.date.today() - dt.timedelta(days=6)
left_query = "{} AND domain:({})".format(query, " OR ".join(left_domains))
right_query = "{} AND domain:({})".format(query, " OR ".join(right_domains))
with open(os.path.join("data", "en_stop_words.txt")) as f:
    stop_words = [l.strip() for l in f.readlines() if len(l.strip())>0 and l[0] != "#"]
    
more_weeks = True
current_start = span_start

while more_weeks:
    # fetch data
    print("working on {}".format(current_start))
    current_end = current_start + dt.timedelta(days=7)
    left_terms = client.terms(left_query, current_start, current_end, 'title', 'top')
    left_terms = {term:count for term, count in left_terms.items() if term not in stop_words and len(term) > 3 and not term.isnumeric()}
    right_terms = client.terms(right_query, current_start, current_end, 'title', 'top')
    right_terms = {term:count for term, count in right_terms.items() if term not in stop_words and len(term) > 3 and not term.isnumeric()}

    # write out data
    fieldnames = ['term', 'count']
    datestamp = current_start.strftime('%Y%m%d')
    left_csv_data = []
    for key, value in left_terms.items():
        left_csv_data.append([key,value])
    left_file_name = '{}-top-left.csv'.format(datestamp)
    with open(left_file_name, "w") as f:
        left_csv = csv.writer(f)
        left_csv.writerow(fieldnames)
        for row in left_csv_data:
            left_csv.writerow(row)

    right_csv_data = []
    for key, value in right_terms.items():
        right_csv_data.append([key,value])
    right_file_name = '{}-top-right.csv'.format(datestamp)
    with open(right_file_name, "w") as f:
        right_csv = csv.writer(f)
        right_csv.writerow(fieldnames)
        for row in right_csv_data:
            right_csv.writerow(row)
    
    # update current_start for the next iteration
    current_start = current_end

    # check if we've reached the end of the span
    if current_end >= span_end:
        more_weeks = False
        
    current_start = current_end + dt.timedelta(days=1)

# print final message
print("Finished generating CSV files.")
