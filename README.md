# dmzj-reimagine
Fine, I will do it myself. These are scripts for archiving light novels and comics (both online and hidden) from [dmzj.com](dmzj.com), a popular Chinese translated manga site. There are great [3rd party apps](https://github.com/xiaoyaocz/flutter_dmzj) for dmzj and they are much more useful to most people. I write these just for researching purposes. The API keys are not released, you may find it by decompiling the app yourself.

Working as for April 2025.

# Archive light novels as EPUB files
see [here](./epubMaker.js)

# Archive and organize manga as images and metadata-included `cbz` files
> I'm able to migrate all my subscribed manga (~200 titles, ~40GB) using these scripts to my local NAS, and it's fully compatible with Komga.
- see [here](./comicArchiver.js)
- Supports updating comic archives using incremental option.
- [Batch input](./comicSubscriptionImporter.js) subscription list using DMZJ's static html. In future I may also use this to extract and migrate reading progress to self-hosted comic services like Komga.
- [Batch update](./comicBatchUpdater.js) local comics using incremental downloading.
- [Tasks](./comic/tasks/) like validating local metadata and Cbz files if the archive is unexpectedly stopped or corrupted.

