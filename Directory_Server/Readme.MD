# Directory Server

<hr>

* The Directory Server is a trusted server which manages the information required for Lilac to operate as a system. That is, the Directory Server maintains information about the Lilac relays and presence servers. When one of these servers come online, they must first register themselves with the directory server and provide their IP address, public key and function (relay or presence server). The directory server is then able to compile the collection of online relays and presence servers, and update this collection as servers come online and go online. The architecture of Lilac allows for a single presence server, and so the Directory Server operates on a first come-first server basis, with the first presence server to register itself being Presence Server for the system, and any following servers which register become backups in case the primary server goes down. In the case where no presence servers are available in the system, the Directory Server itself can undertake the role.

* The Directory Server also performs the function of serving content to Lilac's clients. A user wishing to use Lilac will simply enter the domain name of the Directory Server into a modern web browser. The Directory Server will then serve pages which make up the Lilac user interface (UI) and the client-side program logic, as well as the details of the presence server and set of relays which are known to be online.

* The implementation of Lilac as a web application; requiring no additional software requirements on the client's part (other than a modern web browser) is a step in the direction towards user-friendliness and usability. We believe this design decision will make the average user more receptive to using our system, as opposed to requiring them to download and install additional, unknown software to their personal computer.

## Installation

`npm install`

## Usage

`npm start`

## Important Files
* Node Modules
	* Socket.io
	* express.js
* Public (This folder contains two important files)
	* [main.js](https://github.com/revanthpobala/Lilac/blob/master/Directory_Server/public/main.js) - This file contains all the required functionality to create a circuit. If you want to develop or include any additional functionality, please change in this file. Note, some values of the variables should not be changed. Changing so, will create some inconsistiencies.
	* [creds.json](https://github.com/revanthpobala/Lilac/blob/master/Directory_Server/public/creds.json) - This file consists of IP address and public keys of relays, while in development use your private network. If you want to connect from localhost to Lilac network, you need to download creds.json file from [here](www.thelilacproject.org/creds.json). NOTE: <b>DO NOT ABUSE THE SYSTEM.</b>


## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :)

## History

This is the Initial version that is released to the public. This is my thesis project. This work is sonsored by [National Science Foundation](https://www/nsf.gov).

## Credits

* [Revanth Pobala](revanthpobala.com)
* [Hussain Mucklai](linkedin.com/in/hussainmucklai)

## License

  Copyright (c) 2016 Hussain Mucklai & Revanth Pobala

  Permission is hereby granted, free of charge, to any person obtaining a copy of
  this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
  OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
