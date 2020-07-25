let startEntry = function (toggl, descr) {
    toggl.startEntry({ description: descr },
        (err, timeEntry) => {
            if (err) {
                console.error(err);
            }
            console.log(timeEntry)
        })
}

let stopActiveEntry = function (toggl) {
    toggl.getCurrentTimeEntry((err, timeEntry) => {
        if (err) {
            console.error(err);
        }
        console.log(timeEntry);
        toggl.update(timeEntry.id, { stop: new Date().toDateString() })
    })
}


module.exports = {
    startEntry:startEntry,
    stopActiveEntry:stopActiveEntry
};