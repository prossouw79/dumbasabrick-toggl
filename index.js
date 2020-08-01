'use strict';

require('datejs')

const fs = require('fs');
const path = require('path');
const TogglClient = require('toggl-api');
const { parseFromTimeZone } = require('date-fns-timezone');
const express = require('express');
const _ = require('lodash')

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
const TOGGL_WORKSPACE_ID = +process.env.TOGGL_WORKSPACE_ID;
if (!API_TOKEN) {
    console.error("Set TOGGL_API_TOKEN environment variable.")
    process.exit(1);
}

if (!TOGGL_WORKSPACE_ID) {
    console.error("Set TOGGL_WORKSPACE_ID environment variable.")
    process.exit(1);
}

const toggl = new TogglClient({ apiToken: API_TOKEN });

const app = express()
app.use(express.static('web'))
const port = 3000

let model = {
    updated: null,
    workspaceId: {},
    tags: [],
    projects: [],

}
function initModel() {
    model.updated = new Date();

    toggl.getWorkspaces((err, workspaces) => {
        if (err) {
            console.error("Could not read workspaces", err)
            process.exit(1);
        }

        let wSpace = _.filter(workspaces, w => {
            return w.id == TOGGL_WORKSPACE_ID;
        });

        if (wSpace.length == 0) {
            console.error(`Workspace '${TOGGL_WORKSPACE_ID}' could not be read.`)
            process.exit(1);
        }

        model.workspaceId = wSpace[0].id;

        toggl.getWorkspaceTags(model.workspaceId, (err, tags) => {
            if (err) {
                console.error("Could not read tags", err)
                process.exit(1);
            }

            model.tags = tags.map(t => {
                return {
                    name: t.name,
                    id: t.id
                }
            })
        });

        toggl.getWorkspaceProjects(model.workspaceId, (err, projects) => {
            if (err) {
                console.error("Could not read projects", err)
                process.exit(1);
            }

            model.projects = projects.map(p => {
                return {
                    name: p.name,
                    id: p.id
                }
            })
        })
    })
}

initModel();

setInterval(() => {
    initModel();
}, 60000);


app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/web/index.html'));
});

app.get('/config', function (req, res) {
    res.send(config)
});

app.get('/model', function (req, res) {
    res.send(model)
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
        if (err)
            res.send(err)
        else {
            console.info("Got day entries between", todayStart, todayEnd, resp.length)

            res.send({
                from: todayStart,
                to: todayEnd,
                entries: resp
            });
        }
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

    //waitForRequestLimit();

    toggl.getTimeEntries(monday, friday, (err, resp) => {
        if (err)
            res.send(err)
        else {
            console.info("Got week entries between", monday, friday, resp.length)

            res.send({
                from: monday,
                to: friday,
                entries: resp
            });
        }
    });
});

app.get('/monthEntries', (req, res) => {
    let date = new Date()
    var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    setTZ(firstDay);
    firstDay.setHours(0, 0, 0);

    var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    setTZ(lastDay);
    lastDay.setHours(23, 59, 59);


    //waitForRequestLimit();
    toggl.getTimeEntries(firstDay, lastDay, (err, resp) => {
        if (err)
            res.send(err)
        else {
            console.info("Got month entries between", firstDay, lastDay, resp.length)

            res.send({
                from: firstDay,
                to: lastDay,
                entries: resp
            });
        }
    });
});



const listen = '0.0.0.0'
app.listen(port, listen,
    () => console.log(`Example app listening at http://${listen}:${port}`)
)