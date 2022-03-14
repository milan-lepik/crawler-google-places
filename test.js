const Apify = require('apify');

const move = async (page, mouse) => {
    for (let y = 200; y < 700; y += 10) {
        for (let x = 200; x < 1200; x += 10) {
            // await page.waitForTimeout(5);
            await mouse.move(x, y, { steps: 5 });
            console.log(`x ${x}, y ${y}`);
        }
    }
}

Apify.main(async () => {
    const browser = await Apify.launchPuppeteer();
    const page = await browser.newPage();

    await page.goto('https://www.google.com/maps/@50.0429844,15.77749,14z');
    await page.waitFor(500);
    await page.click('form .VfPpkd-LgbsSe .VfPpkd-vQzf8d');
    await page.waitFor(1000);

    const { mouse } = page;

    page.on('response', async (res) => {
        if (res.url().includes('/preview/place')) {
            const text = await res.text();
            const json = text.replace(")]}'", '');
            const data = JSON.parse(json);
            const richData = data[6];
            const url = richData[42];
            const street = richData[183][1][1]
            console.log(`URL: ${url}, street ${street}`)
            await Apify.pushData({ url, street })
        }
    })

    // should capture 29 places
    const start = Date.now();
    await move(page, mouse)
    const end = Math.round((Date.now() - start) / 1000)
    console.log(`Took ${end} secs`)
})