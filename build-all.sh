#!/bin/bash

cd ./producer-service
./build.sh
cd ../consumer-service
./build.sh
cd ../frontend-service
./build.sh
cd ../consumer-test-service
./build.sh
cd ../producer-test-service
./build.sh

