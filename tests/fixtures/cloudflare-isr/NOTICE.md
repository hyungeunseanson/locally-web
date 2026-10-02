# Extracted test fixture

`stable-extracted.json` contains generated OpenNext client/DO modules and Wrangler bundler helpers from the ETag-linked stable artifact identified in its provenance metadata. Private preview/build constants were replaced with synthetic fixture values before saving. No application modules, credentials or Production state are included. These sources are used only by the offline compatibility tests, never as runtime implementations. New-generation DO code is compiled directly from the installed package during tests.

OpenNext Cloudflare and bundled Wrangler helpers: Copyright (c) 2020 Cloudflare, Inc.
OpenNext AWS: Copyright (c) 2022 SST.

The bundled upstream components are provided under the following MIT license:

MIT License

Copyright (c) 2022 SST

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
