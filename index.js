const fs = require('fs');
const path = require('path');
const DomParser = require('dom-parser');
const parser = new DomParser();
const functionToPromise = require('./utilities/functionToPromise');
const request = functionToPromise(require('request'));
const mkdirp = functionToPromise(require('mkdirp'));
const writeFile = functionToPromise(fs.writeFile);


// 194 piece
const urls = [
    'http://antropogenez.ru/articles/p/1',
    'http://antropogenez.ru/articles/p/2',
    'http://antropogenez.ru/articles/p/3',
    'http://antropogenez.ru/articles/p/4',
    'http://antropogenez.ru/articles/p/5',
    'http://antropogenez.ru/articles/p/6',
    'http://antropogenez.ru/articles/p/8',
    'http://antropogenez.ru/articles/p/9',
    'http://antropogenez.ru/articles/p/10',
    'http://antropogenez.ru/articles/p/11',
    'http://antropogenez.ru/articles/p/12',
    'http://antropogenez.ru/articles/p/13',
    'http://antropogenez.ru/articles/p/14',
    'http://antropogenez.ru/articles/p/15',
    'http://antropogenez.ru/articles/p/16',
    'http://antropogenez.ru/articles/p/17',
    'http://antropogenez.ru/articles/p/18',
    'http://antropogenez.ru/articles/p/19',
    'http://antropogenez.ru/articles/p/20',
    'http://antropogenez.ru/articles/p/21',
];

class Queue {
    constructor(maxRunning) {
        this.maxRunning = maxRunning;
        this.running = 0;
        this.queue = [];
    }

    pushTask(task) {
        this.queue.push(task);
        this.next();
    }

    next() {
        while (this.running < this.maxRunning && this.queue.length) {
            const task = this.queue.shift();
            task()
                .then(() => {
                    this.running--;
                    this.next();
                });
            this.running++;
        }
    }
}

function getArticlesData(body) {
    const dom = parser.parseFromString(body, 'text/html');
    const articles = dom
        .getElementById('content')
        .getElementsByClassName('articles_items');
    return articles.map(elem => {
        const dateNode = elem.getElementsByClassName('articles_list_date');
        const subjectNode = elem.getElementsByClassName('articles_list_subject')[0];
        const urlNode = subjectNode.getElementsByTagName('a')[0];

        const date = dateNode[0].innerHTML;
        const subject = urlNode.innerHTML;
        let url = urlNode.getAttribute("href");

        if (url.search(/http:\/\/antropogenez.ru/i) === -1) {
            url = `http://antropogenez.ru/${url}`
        }
        return {date, subject, url}
    })
}

function getArticleText(body) {
    const content = parser.parseFromString(body, 'text/html').getElementById('content');
    const article = content.getElementsByClassName('tx-antropedia-pi1');
    if (article.length === 0) {
        return content.innerHTML;
    }
    return article[0].innerHTML;
}

function saveFile(filename, contents) {
    return mkdirp(path.dirname(filename))
        .then(_ => writeFile(filename, contents));
}

function downloadArticle(url, filename) {
    return request(url)
        .then(({body, statusCode}) => {
            return getArticleText(body);
        })
        .then(text => saveFile(`articles/${filename}.txt`, text))
}

const queue = new Queue(3);

function spiderLinks(currentUrl, body, nesting) {
    if (nesting === 0) {
        return Promise.resolve();
    }
    const links = getArticlesData(body);
    if (links.length === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        let completed = 0;
        let error = false;
        links.forEach(link => {
            const task = () => {
                return spider(link, nesting - 1)
                    .then(_ => {
                        if (++completed === links.length) {
                            return resolve(currentUrl)
                        }
                    })
                    .catch(err => {
                        if (!error) {
                            error = err;
                            reject(err);
                        }
                    });
            };
            queue.pushTask(task);
        })
    })
}

const spideringMap = new Map();

function spider(linkData, nesting) {
    const filename = linkData.subject ? linkData.subject : linkData;
    const url = linkData.url ? linkData.url : linkData;

    if (spideringMap.has(url)) {
        return Promise.resolve()
    }
    spideringMap.set(url, true);

    return request(url)
        .then(({body, statusCode}) => {
            if (nesting === 0) {
                console.log('Downloading: ' + filename);
                downloadArticle(url, filename);
            }
            return body;
        })
        .then(body => spiderLinks(filename, body, nesting))
}

urls.forEach(url => {
    /*
    downloading only with nesting = 0
     */
    spider(url, 1)
        .then(filename => console.log(`"${filename}" was already downloaded`))
        .catch(err => console.log(err));
});


