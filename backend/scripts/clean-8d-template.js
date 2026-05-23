'use strict';

const { writeCleanSsh8dTemplate } = require('../src/ssh8dReport');

writeCleanSsh8dTemplate()
    .then(() => {
        console.log('ssh-8d-template.xlsx örnek veriler temizlendi.');
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
