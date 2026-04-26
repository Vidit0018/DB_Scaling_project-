import pandas as pd

file_path = "C:/Users/raphe/Webdev/Projects/db_scale/DB_Scaling_project-/yellowTripdata2015-01.csv"
output_path = "C:/Users/raphe/Webdev/Projects/db_scale/DB_Scaling_project-/yellowTripdata_sample.csv"

chunksize = 100000
sampled_chunks = []

for chunk in pd.read_csv(file_path, chunksize=chunksize):
    sampled_chunks.append(chunk.sample(frac=0.2))

df_sample = pd.concat(sampled_chunks)
df_sample.to_csv(output_path, index=False)

print("Saved sampled dataset")