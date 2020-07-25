'use strict';

require('datejs')

const fs = require('fs');
const path = require('path');
const TogglClient = require('toggl-api');
const { parseFromTimeZone} = require('date-fns-timezone');
const express = require('express');

const configPath = path.join(__dirname, '/config/model.json');

if (!fs.existsSync(configPath)) {
    console.error(`Expecting config file at ${configPath}. Create sample from template...`);
    fs.copyFileSync(path.join(__dirname, 'configTemplate.json'), configPath)
    process.exit(1)
}

console.log("Reading model.json")
let modelJson = fs.readFileSync(configPath);
let config = JSON.parse(modelJson);

const API_TOKEN = process.env.TOGGL_API_TOKEN;
if (!API_TOKEN) {
    console.error("Set TOGGL_API_TOKEN environment variable.")
    process.exit(1);
}

const toggl = new TogglClient({ apiToken: API_TOKEN });

const app = express()
app.use(express.static('web'))
const port = 3000

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/web/index.html'));
});

app.get('/config', function (req, res) {
    res.send(config)
});

app.get('/startEntry', (req, res) => {
    let params = req.query;
    console.log("Starting task with:", params);
    toggl.startTimeEntry({
        description: params.description,
        tags: params.tags.includes(",") ? params.tags.split(',') : [params.tags]
    }, function (err, timeEntry) {
        if (err)
            res.send(err);
        else
            res.send(JSON.stringify(timeEntry))
    })
});

app.get("/getActiveEntry", (req, res) => {
    toggl.getCurrentTimeEntry((err, timeEntry) => {
        if (err) {
            res.send(err);
        } else {
            res.send(timeEntry ? timeEntry : { id: 0 })
        }
    })
})

app.get('/stopEntry', (req, res) => {
    toggl.getCurrentTimeEntry((err, currentTimeEntry) => {
        if (err) {
            res.send(err);
        } else {
            toggl.stopTimeEntry(currentTimeEntry.id, (err, timeEntry) => {
                if (err) {
                    res.send(err);
                } else {
                    res.send(JSON.stringify(timeEntry));
                }
            })
        }
    });
});

app.get('/todayEntries', (req, res) => {
    let todayStart = new Date()
    setTZ(todayStart);
    todayStart.setHours(0, 0, 0);

    let todayEnd = new Date()
    setTZ(todayEnd);
    todayEnd.setHours(23, 59, 59);

    toggl.getTimeEntries(todayStart, todayEnd, (err, resp) => {
        res.send({
            from: todayStart,
            to: todayEnd,
            entries: resp
        });
    });
});

function setTZ(date) {
    date = parseFromTimeZone(date, { timeZone: 'Africa/Johannesburg' })
}

app.get('/weekEntries', (req, res) => {
    let monday = Date.monday()
    monday.setHours(0, 0, 0);
    setTZ(monday);


    let friday = Date.friday()
    friday.setHours(23, 59, 59);
    setTZ(friday);

    toggl.getTimeEntries(monday, friday, (err, resp) => {
        res.send({
            from: monday,
            to: friday,
            entries: resp
        });
    });
});

app.get('/monthEntries', (req, res) => {
    let monday = Date.today().first().monday()
    setTZ(monday);
    monday.setHours(0, 0, 0);

    let friday = Date.today().last().friday()
    setTZ(friday);
    friday.setHours(23, 59, 59);

    toggl.getTimeEntries(monday, friday, (err, resp) => {
        res.send({
            from: monday,
            to: friday,
            entries: resp
        });
    });
});

const listen = '0.0.0.0'
app.listen(port, listen,
    () => console.log(`Example app listening at http://${listen}:${port}`)
)