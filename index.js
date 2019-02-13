const request = require('request');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const DomParser = require('dom-parser');
const parser = new DomParser();

const urls = [
    'http://antropogenez.ru/articles/p/1',
    'http://antropogenez.ru/articles/p/2',
    'http://antropogenez.ru/articles/p/3',
    'http://antropogenez.ru/articles/p/4',
    'http://antropogenez.ru/articles/p/5',
    // 'http://antropogenez.ru/articles/p/6',
    // 'http://antropogenez.ru/articles/p/8',
    // 'http://antropogenez.ru/articles/p/9',
    // 'http://antropogenez.ru/articles/p/10',
    // 'http://antropogenez.ru/articles/p/11',
    // 'http://antropogenez.ru/articles/p/12',
    // 'http://antropogenez.ru/articles/p/13',
    // 'http://antropogenez.ru/articles/p/14',
    // 'http://antropogenez.ru/articles/p/15',
    // 'http://antropogenez.ru/articles/p/16',
    // 'http://antropogenez.ru/articles/p/17',
    // 'http://antropogenez.ru/articles/p/18',
    // 'http://antropogenez.ru/articles/p/19',
    // 'http://antropogenez.ru/articles/p/20',
    // 'http://antropogenez.ru/articles/p/21',
];

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

function saveFile(filename, contents, callback) {
    mkdirp(path.dirname(filename), err => {
        if (err) {
            return callback(err);
        }
        fs.writeFile(filename, contents, callback);
    });
}

function downloadArticle(url, filename, callback) {
    request(url, (err, resp, articleBody) => {
        if (err || resp.statusCode >= 400) {
            return callback(err)
        }
        const text = getArticleText(articleBody);
        saveFile(`articles/${filename}.txt`, text, err => {
            if (err) {
                return callback(err);
            }
            callback(null, filename);
        })
    })
}

class TaskQueue {
    constructor(concurrency) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    pushTask(task) {
        this.queue.push(task);
        this.next();
    }

    next() {
        while (this.running < this.concurrency && this.queue.length) {
            const task = this.queue.shift();
            task(() => {
                this.running--;
                this.next();
            });
            this.running++;
        }
    }
}

const downloadQueue = new TaskQueue(2);

function spiderLinks(currentUrl, body, nesting, callback) {
    if (nesting === 0) {
        return process.nextTick(callback);
    }
    const links = getArticlesData(body);
    if (links.length === 0) {
        return process.nextTick(callback);
    }
    let completed = 0, hasErrors = false;
    links.forEach(link => {
        downloadQueue.pushTask(done => {
            spider(link, nesting - 1, err => {
                if (err) {
                    hasErrors = true;
                    return callback(err);
                }
                if (++completed === links.length && !hasErrors) {
                    callback(null, currentUrl);
                }
                done();
            });
        });
    });

}

const spideringMap = new Map();

function spider(linkData, nesting, callback) {
    const filename = linkData.subject ? linkData.subject : linkData;
    const url = linkData.url ? linkData.url : linkData;

    if (spideringMap.has(url)) {
        return process.nextTick(callback)
    }
    spideringMap.set(url, true);

    request(url, (err, resp, body) => {
        if (err || resp.statusCode >= 400) {
            return callback(err)
        }
        if (nesting === 0) {
            console.log('Downloading: ' + filename);
            return downloadArticle(url, filename, (err, filename) => {
                if (err) {
                    return callback(err);
                }
                return callback(null);
            });
        }
        spiderLinks(filename, body, nesting, callback);
    });
}


urls.forEach(url => {
    /*
    downloading only with nesting = 0
     */
    spider(url, 1, (err, filename) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`"${filename}" was already downloaded`);
        }
    });
});


