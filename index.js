const fs = require('fs');
const path = require('path');
const DomParser = require('dom-parser');
const parser = new DomParser();
const thunkify = require('thunkify');
const co = require('co');
const request = thunkify(require('request'));
const mkdirp = thunkify(require('mkdirp'));
const writeFile = thunkify(fs.writeFile);
const nextTick = thunkify(process.nextTick);

const urls = [
    'http://antropogenez.ru/articles/p/1',
    // 'http://antropogenez.ru/articles/p/2',
    // 'http://antropogenez.ru/articles/p/3',
    // 'http://antropogenez.ru/articles/p/4',
    // 'http://antropogenez.ru/articles/p/5',
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

/*
    body:string - page
    return - [{date, subject, url}] by page
 */
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

/*
  body: string - page of article
  return text of article
 */
function getArticleText(body) {
    const content = parser.parseFromString(body, 'text/html').getElementById('content');
    const article = content.getElementsByClassName('tx-antropedia-pi1');
    if (article.length === 0) {
        return content.innerHTML;
    }
    return article[0].innerHTML;
}

function* downloadArticle(url, filename) {
    const response = yield request(url);

    const body = response[1];
    const text = getArticleText(body);
    const pathToFile = `articles/${filename}.txt`;

    yield mkdirp(path.dirname(pathToFile));

    yield writeFile(pathToFile, text);
    console.log(filename)
    return body;
}


function* spider(pageData, nesting) {
    const filename = pageData.subject ? pageData.subject : pageData;
    const url = pageData.url ? pageData.url : pageData;
    let body;
    try {
        if (nesting === 0) {
            body = yield downloadArticle(url, filename)
        } else {
            const response = yield request(url);
            body = response[1];
        }
    } catch (err) {
        throw err
    }
    yield spiderLinks(filename, body, nesting);
}

function* spiderLinks(filename, body, nesting) {
    if (nesting === 0) {
        return nextTick();
    }
    const links = getArticlesData(body);

    const tasks = links.map(link => spider(link, nesting - 1));
    yield tasks;
}

co(function* () {
    try {
        for (let i = 0; i < urls.length; i++) {
            yield spider(urls[i], 1);
        }
        console.log('Download complete');
    } catch (err) {
        console.log(err);
    }
});
