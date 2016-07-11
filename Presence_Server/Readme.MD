# Presence Server



* The Presence Server serves a central role in establishing connections between chat partners.
To do this, the Presence Server performs two functions: maintaining a list of online users and
responding to requests to connect users. When a user accesses the Lilac web application, she
is asked to provide a user-name to identify herself. This user-name is then used to mark the
user as online for a specific period of time (more on this later). The Presence Server is then
sent the user's identifying name, which it must store for future use. To begin communicating,
the user must submit a request to start a chat by providing the user-name of her intended
chat partner.

*	The Presence Server receives this identifying name with the identifying name
of the requester. The Presence Server then searches for the presence of the recipient in its
records. If found, it forwards the request (with the requester's identifying name) to the intended recipient. To protect the recipient's privacy, no feedback is sent to the requester at
this point. So if she is not able to connect to the recipient, she is not able to determine if
the recipient is online, or is online and has ignored her request.

## Installation

`npm install`

## Usage

 `npm start`

## Important Files
* [lp.js](https://github.com/revanthpobala/Lilac/blob/master/Presence_Server/lp.js) - This file consists the functionality of presence server. The instructions to modify and tweak this file are mentioned in the file.


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
