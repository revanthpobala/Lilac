# Lilac - Lightweight Low Latency Anonymous Chat.


## Introduction

Lilac is a <b>LI</b>ghtweight <b>L</b>owlatency <b>A</b>nonymous <b>C</b>hat. It is more than an instant messaging system. Lilac provides unmatched security and anonymity as compared to other existing messaging systems. In fact, Lilac is way more secure than [TorChat](https://github.com/prof7bit/TorChat) because Lilac protects the users from Traffic analysis. Lilac can defend the users from against powerful governments who supress freedom of speech or monitor you. If you want to learn more about Lilac please read my thesis report [here](revanthpobala.oom/thesis.pdf).


## Installation

#### Prerequsitie
* [NodeJS](nodejs.org)


## Folder Structure

* Directory Server
* Node
* Presence Server

## Starting Lilac

Firstly, you need to start Directory Server. You can start the directory server by using `npm start` command. If you don't want to use nodejs, you need to serve the [Public](https://github.com/revanthpobala/Lilac/tree/master/Directory_Server/public) folder from your favorite language.

Next, you need to start presence server. Once you start the presence server, you will receive `presence server connected` log on Directory servers' command line.

Finally, It's now time to create a relay server network. You can create as many relays as you want. Run this command `npm start` under Node folder. If there is a conflict in the port Address, please restart the server again.

If you don't want to use `npm start` command you can start Lilac by issuing following commands.

`node ..\Directory_Server\server.js`
<br>
`node ..\Presence_Server\lp.js`
<br>
`node ..]\Node\nc.js`

Explore the source code and implement awesome features.

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
