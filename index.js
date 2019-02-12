const request = require('request');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const DomParser = require('dom-parser');
const parser = new DomParser();

function getArticlesData(body) {
    const dom = parser.parseFromString(body, 'text/html');
    const articles = dom
        .getElementById('content')
        .getElementsByClassName('articles_items');
    return articles.map(elem => {
        const dateNode = elem.getElementsByClassName('articles_list_date');
        const subjectNode = elem.getElementsByClassName('articles_list_subject')[0];
        const slugNode = subjectNode.getElementsByTagName('a')[0];

        const date = dateNode[0].innerHTML;
        const subject = slugNode.innerHTML;
        const slug = slugNode.getAttribute("href");
        return {date, subject, slug}
    })
}

function getArticleText(body) {
    const dom = parser.parseFromString(body, 'text/html');
    const article = dom
        .getElementById('content')
        .getElementsByClassName('tx-antropedia-pi1');
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


function spider(url, callback) {
    request(url, (err, resp, body) => {
        if (err) {
            return callback(err)
        }
        const articles = getArticlesData(body);

        articles.forEach(({date, subject, slug}) => {
            request(slug, (err, resp, articleBody) => {
                const text = getArticleText(articleBody);
                saveFile(`articles/${date}.txt`, text, err => {
                    if (err) {
                        return callback(err);
                    }
                    console.log(`Downloaded and saved: ${date}`);
                    callback(null, date);
                })
            })
        })
    })
}


const url = 'http://antropogenez.ru/articles/';

spider(url, (err, filename, downloaded) => {
    if (err) {
        console.log(err);
    } else if (downloaded) {
        console.log(`Completed the download of "${filename}"`);
    } else {
        console.log(`"${filename}" was already downloaded`);
    }
});
