import csv 
from datetime import date 

# generate today's date for csv 
today = date.today()

# format as YYYYMMDD
date = today.strftime("%Y%m$d")

header = [['term', 'count']]

# create left terms CSV file 
with open(date + '-top-left.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    # write header 
    writer.writerow(header)


# t-5 and t-7 days since we call it on the friday 
# look for the jupyter notebook  from first email 
# call API 


