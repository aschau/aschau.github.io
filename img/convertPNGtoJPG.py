import os

for file in [f for f in os.listdir('.') if os.path.isfile(f)]:
    if file[-3:] == "png":
        print("OLD FILE: " + file)
        os.rename(file, file[:-3] + "jpg")
        print("NEW FILE: " + file[:-3] + "jpg")
