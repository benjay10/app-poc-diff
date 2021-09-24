#!/bin/bash

cd producer-service
./build.sh
#./consumer-service/build.sh
cd ../frontend-service
./build.sh

