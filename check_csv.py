import os
import datetime as datetime
import subprocess

# Define the directory where the CSV files are stored
directory = 'data/'

# Define the start and end dates of the sequence
start_date = '20220801'
end_date = datetime.datetime.now().strftime('%Y%m%d')  # Set the end date to the current date

# Loop through the dates in the sequence
current_date = start_date
while current_date <= end_date:

    # Check if the top-left and top-right files for the current date exist
    top_left_file = f"{current_date}-top-left.csv"
    top_right_file = f"{current_date}-top-right.csv"

    if not os.path.exists(os.path.join(directory, top_left_file)):
        print(f"Missing file: {top_left_file}")
        # Generate the CSV file using generate_csv.py
        subprocess.run(['python', 'generate_data.py'])
    
    if not os.path.exists(os.path.join(directory, top_right_file)):
        print(f"Missing file: {top_right_file}")
        # Generate the CSV file using generate_csv.py
        subprocess.run(['python', 'generate_data.py'])

    # Increment the current date by one week
    current_date = (datetime.datetime.strptime(current_date, '%Y%m%d') + datetime.timedelta(weeks=1)).strftime('%Y%m%d')
