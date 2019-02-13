const request = require('request');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const DomParser = require('dom-parser');
const parser = new DomParser();

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

/*
    filename: string
    contents: string
    callback: function
 */
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
        if (err) {
            return callback(err)
        }
        const text = getArticleText(articleBody);
        saveFile(`articles/${filename}.txt`, text, err => {
            if (err) {
                return callback(err);
            }
            console.log(`Saved: ${filename}`);
            callback(null, filename);
        })
    })
}


function spider(pageData, nesting, callback) {
    const filename = pageData.subject ? pageData.subject : pageData;
    const url = pageData.url ? pageData.url : pageData;

    request(url, (err, resp, body) => {
        if (nesting === 0) {
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

function spiderLinks(filename, body, nesting, callback) {
    if (nesting === 0) {
        return process.nextTick(callback);
    }
    const links = getArticlesData(body);

    function iterate(index) {
        if (index === links.length) {
            return callback(null, filename);
        }
        spider(links[index], nesting - 1, function (err) {
            if (err) {
                return callback(err);
            }
            iterate(index + 1);
        });
    }
    iterate(0);
}

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

