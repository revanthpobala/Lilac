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
node -v 
exit
