# This script is used to get the public IP address from AWS.
curl http://169.254.169.254/latest/meta-data/public-ipv4 > public-ipv4
