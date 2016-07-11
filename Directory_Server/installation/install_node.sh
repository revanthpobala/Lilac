#  Copyright (c) <2016> <Hussain Mucklai & Revanth Pobala>
#
#  Permission is hereby granted, free of charge, to any person obtaining a copy of
#  this software and associated documentation files (the "Software"), to deal
#  in the Software without restriction, including without limitation the rights
#  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#  copies of the Software, and to permit persons to whom the Software is
#  furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be
#  included in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
#  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
#  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
#  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
#  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
#  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
#  OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# This file is used to install node.js in Fedora, RedHat and other linux distributions.

yum update -y
yum install gcc gcc-c++ -y
yum install make -y
echo "installing unzip"
yum install unzip -y
yum install python-simplejson -y
wget http://nodejs.org/dist/v0.10.29/node-v0.10.29.tar.gz
tar zxvf node-v0.10.29.tar.gz
cd node-v0.10.29
./configure
make
make install
# Check if nodejs is installed correctly or not. 
node -v
exit
