US Partisans Discourse in News Headlines
========================================

This project is a web based application that allows users to pick explore the evolution of terms used in
headlines across partisan US media collections over time. The goal of this project is to provide an 
easy-to-understand illustration of what types of topics and ideas may be driving discourse. This helps us gain
a better understanding of of the political and social issues that are currently being discussed and 
debated within different ideological groups across the broader online media ecosystem.

## Developing

Data is pulled regularly from the Media Cloud API and stored in raw CSV files. Run `generate_data.py` to create the weekly data files. Then run `prepare_data.py` to generate word-by-word files with usage over time.

## License
This project is licensed under the [MIT License](https://opensource.org/license/mit/).

## Contributors

- Rahul Bhargava
- Clair Pan
