# Nodeclient Server

<hr>

* Nodeclient servers' or relays are volunteer-based servers which perform the same functionality in Lilac as the
relays do in [Tor](torproject.org), anonymizing traffic. Relays in Lilac, unlike Tor, exclusively handle
textual traffic related to chat. Because this traffic is lightweight, we do not need to be overly
concerned with the bandwidth of our relays. As such, we may choose three relays (from the
list provided by the Directory Server) completely randomly for our circuit. This eliminates
any bias which malicious relays might attempt to exploit to get more traffic coming their
way.
## Installation

 `npm install `

## Usage

 `npm start`

## Important Files
* [nc.js](https://github.com/revanthpobala/Lilac/blob/master/Node/nc.js) - This file consists of the core functionality of a relay. Tweak it to get better performance.


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
