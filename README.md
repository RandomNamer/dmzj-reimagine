# The once No.1 site for web crawler and mobile dev learners, now in another flavor


Fine, I will do it myself. Yet another set of scripts for archiving light novels and comics (both online and hidden) from [dmzj.com](dmzj.com), a popular Chinese translated manga site. There are great [3rd party apps](https://github.com/xiaoyaocz/flutter_dmzj) for dmzj and they are much more useful to most people. I write these just for researching purposes. The API keys are not released, you may find it by decompiling the app yourself.

# It's official, it's dead.

Starting mid-June 2025, the DMZJ website is not accessible with only a few API and storage services still being alive. At first, a staff member said it's due to DDoS attacks. Then he's gone, and the site never came back. 

On Sep 10th 2025, it's reported that DMZJ is dead. It quickly became a top search in Chinese social media. After a long struggle, an era has ended.  

I have finished a [final update](https://zeyuzhang3.notion.site/DMZJ-crawler-final-PRD-and-tracker-132d6dc1a5c280fb8f86e0081c7ed5b4) to embrace the demise of the once legendary pirate.


# Archive light novels as EPUB files
see [here](./epubMaker.js)

# Archive and organize manga as images and metadata-included `cbz` files
> I'm able to migrate all my subscribed manga (~200 titles, ~40GB) using these scripts to my local NAS and host them with Komga.
> <img width="1389" alt="image" src="https://github.com/user-attachments/assets/afc97f2a-2b27-469d-acdd-f6bf6e21018c" />

- [Archive Single](./comicArchiver.js): Supports updating comic archives using incremental option. Supports newest API so that you can download VIP comics with VIP uids.
- [Batch import](./comicSubscriptionImporter.js) subscription list using DMZJ's static html. In future I may also use this to extract and migrate reading progress to self-hosted comic services like Komga.
- [Batch update](./comicBatchUpdater.js) local comics using incremental downloading.
- [Tasks](./comic/tasks/) like validating local metadata and Cbz files if the archive is unexpectedly stopped or corrupted.

