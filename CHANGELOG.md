# Changelog

## [0.2.0](https://github.com/karyl-chan/plugin-xiangqi/compare/v0.1.0...v0.2.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **xiangqi:** migrate to SDK eventHandlers (drop custom /events)

### Features

* adopt plugin SDK 0.16 and gate image publishes ([0d1631f](https://github.com/karyl-chan/plugin-xiangqi/commit/0d1631feb53cdd3b0ec951154609f62d8ad53439))
* adopt plugin SDK 0.16 typed RPC ([e0c38a8](https://github.com/karyl-chan/plugin-xiangqi/commit/e0c38a887f2f88175bc2e1c38d103d8e9b4f91e9))
* **ai:** replace fairy-stockfish with Pikafish + NNUE, log random fallbacks ([e747c3b](https://github.com/karyl-chan/plugin-xiangqi/commit/e747c3b69c2143ff78009060c5c94726b9ab8ed1))
* **ai:** stronger hard tier, engine lives for the game ([a0db36f](https://github.com/karyl-chan/plugin-xiangqi/commit/a0db36f63759f107ca40ddeb2b46f0792bc22ab1))
* **game:** pause on draw/takeback offers; embed prompts; clean stale offers ([d8b9eeb](https://github.com/karyl-chan/plugin-xiangqi/commit/d8b9eeb14b9edb93b28c6da48010f359c3389a84))
* **i18n:** three-locale support (en / zh-TW / zh-CN) end-to-end ([0dbdaac](https://github.com/karyl-chan/plugin-xiangqi/commit/0dbdaacae7f29a0af263763fe8c93aebc662f83d))
* manage via bot admin UI link; serve manage SPA at /manage ([4bbc88e](https://github.com/karyl-chan/plugin-xiangqi/commit/4bbc88e4a40f75bb1f2609bdab53799eeeedf4db))
* **notation:** positional disambiguation for 4+ pawns on a file ([6fd7129](https://github.com/karyl-chan/plugin-xiangqi/commit/6fd7129c003149d5595b358cf1ff0a0ff23a0773))
* **webui:** rotate board 180° for the black viewer ([ef9d4ae](https://github.com/karyl-chan/plugin-xiangqi/commit/ef9d4aebd5a6bf2913d06d7b1cece9c6c049fe27))


### Bug Fixes

* **docker:** locate Pikafish NNUE by find instead of fixed glob ([7d4de15](https://github.com/karyl-chan/plugin-xiangqi/commit/7d4de156ad6a96369ca64580fd327e432408b0b6))
* **i18n:** shorten en sideOption desc to ≤100 chars (Discord limit) ([6794d93](https://github.com/karyl-chan/plugin-xiangqi/commit/6794d9390429b8303cc5eb5671f662592748d89f))
* **render:** force embed width with fullwidth rule above board ([5709a23](https://github.com/karyl-chan/plugin-xiangqi/commit/5709a23d04c2d3d408ad4d424da324eb1f60454d))
* **render:** inline board into embed description to avoid field wrap ([df95ddd](https://github.com/karyl-chan/plugin-xiangqi/commit/df95ddd9752dd5d4be63f0d0571dfab1a13968c7))
* **render:** inline river label directly in render function for alignment ([ba9b1a0](https://github.com/karyl-chan/plugin-xiangqi/commit/ba9b1a09e2c94b76873e078e6aa95c1120ed8c01))
* **webui:** never share a baked-token link in the channel ([d088f03](https://github.com/karyl-chan/plugin-xiangqi/commit/d088f03a0d96e6cd4bfaf3f4347b5f2dad7aca61))
* **webui:** restore body scroll, drop wood-theme token remap ([2329a37](https://github.com/karyl-chan/plugin-xiangqi/commit/2329a37f5dacfa87eff1bbd05e3bb48aee0b4b71))
* **xiangqi:** manage button icon dup; align river line width ([3c559d1](https://github.com/karyl-chan/plugin-xiangqi/commit/3c559d1d2d44afe4e9d077e35e3033f68a9e22a1))


### Code Refactoring

* **xiangqi:** migrate to SDK eventHandlers (drop custom /events) ([c4c9241](https://github.com/karyl-chan/plugin-xiangqi/commit/c4c924136f22e38c22aa6d8be01c45b0d1af3e95))
