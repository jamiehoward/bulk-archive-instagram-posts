(async () => {
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // --- Selectors ---
  const containerSelector = '[data-bloks-name="bk.components.Collection"]';
  const postSelector = 'div[aria-label="Image with button"]';
  const selectButtonText = 'Select';
  const archiveTriggerSelector = 'div[role="link"][aria-label="Archive"]';
  const modalArchiveButtonSelector = 'button._a9--._ap36._a9_1';

  // --- Helpers ---
  async function clickElement(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  async function waitForElement(selector, timeout = 8000, visibleCheck = false) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el && (!visibleCheck || getComputedStyle(el).pointerEvents !== 'none')) return el;
      await sleep(300);
    }
    return null;
  }

  async function selectUpTo100(container) {
    const clicked = new WeakSet();
    let selectedCount = 0;
    let lastSelectedCount = 0;
    let attemptsWithoutProgress = 0;

    async function clickVisible() {
      const posts = Array.from(container.querySelectorAll(postSelector));
      for (const post of posts) {
        if (selectedCount >= 100) break;
        if (!clicked.has(post)) {
          clicked.add(post);
          post.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          selectedCount++;
          await sleep(200);
        }
      }
    }

    while (selectedCount < 100) {
      await clickVisible();
      if (selectedCount >= 100) break;

      if (selectedCount === lastSelectedCount) attemptsWithoutProgress++;
      else attemptsWithoutProgress = 0;
      lastSelectedCount = selectedCount;

      if (attemptsWithoutProgress >= 3) {
        console.log('Retrying after slow load...');
        await sleep(3000);
        await clickVisible();
        if (selectedCount === lastSelectedCount) break;
        attemptsWithoutProgress = 0;
      }

      const prevScroll = container.scrollTop;
      container.scrollTop += container.clientHeight;
      await sleep(2000);
      await clickVisible();
      if (container.scrollTop === prevScroll) break;
    }

    console.log(`✅ Selected ${selectedCount} posts this round.`);
    return selectedCount;
  }

  async function archiveBatch() {
    const archiveLink = await waitForElement(archiveTriggerSelector, 10000, true);
    if (!archiveLink) {
      console.warn('⚠️ Archive link not found or not clickable.');
      return false;
    }

    console.log('📦 Clicking Archive bar…');
    await clickElement(archiveLink);
    await sleep(1200);

    const confirmBtn = await waitForElement(modalArchiveButtonSelector, 10000);
    if (confirmBtn) {
      console.log('🗄️ Clicking Archive confirmation button…');
      await clickElement(confirmBtn);
      await sleep(5000); // Wait for Instagram to refresh
      return true;
    } else {
      console.warn('⚠️ Modal Archive button not found.');
      return false;
    }
  }

  async function waitForSelectButton(retries = 30, delay = 5000) {
    for (let i = 0; i < retries; i++) {
      const selectBtn = Array.from(
        document.querySelectorAll('span[data-bloks-name="bk.components.Text"]')
      ).find(el => el.textContent.trim() === selectButtonText);
      if (selectBtn) return selectBtn;
      console.log(`⏳ Waiting for Select button to reappear... (${i + 1}/${retries})`);
      await sleep(delay);
    }

    // Give user control if it never reappears
    const keepGoing = confirm(
      "No 'Select' button found after waiting. Instagram may still be loading.\n\n" +
      "Click OK to keep waiting another minute, or Cancel to stop the script."
    );
    if (keepGoing) {
      return waitForSelectButton(12, 5000); // wait 1 more minute
    }
    return null;
  }

  async function runArchiveLoop() {
    let batch = 1;

    while (true) {
      let selectBtn = await waitForSelectButton();
      if (!selectBtn) {
        console.log('✅ No "Select" button found — assuming all posts archived or process stopped.');
        break;
      }

      console.log(`\n🔹 Starting batch #${batch}`);
      await clickElement(selectBtn);
      await sleep(1000);

      const container = await waitForElement(containerSelector);
      if (!container) {
        console.error('❌ Posts container not found.');
        break;
      }

      const count = await selectUpTo100(container);
      if (count === 0) {
        console.log('No posts selected, exiting loop.');
        break;
      }

      const archived = await archiveBatch();
      if (!archived) {
        console.warn('⚠️ Failed to archive batch — exiting.');
        break;
      }

      console.log(`✅ Batch #${batch} archived ${count} posts.`);
      await sleep(6000);
      batch++;
    }

    console.log('🎉 All done! Every batch has been archived.');
  }

  await runArchiveLoop();
})();
