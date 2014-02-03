// grunt-reporter.js
//
// A communication bridge between blanket.js and the grunt-blanket-mocha plugin
// Distributed as part of the grunt-blanket-mocha library
//
// Copyright (C) 2013 Model N, Inc.
// Distributed under the MIT License
//
// Documentation and full license available at:
// https://github.com/ModelN/grunt-blanket-mocha
// 
(function (){
    "use strict";

    var sendMessage = function sendMessage() {
        var args = Array.prototype.slice.call(arguments);
        if (typeof window.callPhantom === 'function') {
            var status = window.callPhantom({
                type: 'message',
                message: args
            });
        }
    };

    // helper function for computing coverage info for a particular file
    var reportFile = function( data ) {
        var ret = {
            coverage: 0,
            hits: 0,
            misses: 0,
            sloc: 0
        };
        for (var i = 0; i < data.source.length; i++) {
            var line = data.source[i];
            var num = i + 1;
            if (data[num] === 0) {
                ret.misses++;
                ret.sloc++;
            } else if (data[num] !== undefined) {
                ret.hits++;
                ret.sloc++;
            }
        }
        ret.coverage = ret.hits / ret.sloc * 100;

        return [ret.hits,ret.sloc];

    };

    var sortFn = function(a,b){
        return parseInt(a) - parseInt(b);
    };

    var reportLcov = function(filename, data, options) {

        var i, branchId, branchIds = [], branchCounts, str = "";

        var totalLines = 0, linesCovered = 0, totalBranches = 0, branchesCovered = 0, totalFunctions = 0, functionsCovered = 0;;

        if (options && options.filename_from && options.filename_to) {
            filename = filename.replace(new RegExp(options.filename_from), options.filename_to);
        }

        str += 'SF:' + filename + '\n';

        if (data.functionTracks) {

            var fns = '';
            var fndas = '';

            Object.keys(data.functionTracks).sort(sortFn).map(function(lineNumber) {
                var functionData = data.functionTracks[lineNumber];

                // Function location (line number, name)
                fns += 'FN:' + lineNumber + ',' + functionData.name + '\n';

                // Function runs (hit count, name)
                fndas += 'FNDA:' + functionData.count + ',' + functionData.name + '\n';

                totalFunctions++;
                if (functionData.count > 0) {
                    functionsCovered++;
                }

            });

            str += fns;
            str += fndas;

            str += 'FNF:' + totalFunctions + '\n';
            str += 'FNH:' + functionsCovered + '\n';
        }

        if (data.branchTracks) {
            Object.keys(data.branchTracks).sort(sortFn).map(function(lineNumber) {
                Object.keys(data.branchTracks[lineNumber]).sort(sortFn).map(function(colNumber){

                    // We increment by 1 because the id is index1 based
                    branchId = branchIds.indexOf(lineNumber + ":" + colNumber) + 1;
                    if (branchId === 0) {
                        // push returns new length of array so no increment required
                        branchId = branchIds.push(lineNumber + ":" + colNumber);
                    }

                    /* Array */ branchCounts = data.branchTracks[lineNumber][colNumber];
                    totalBranches += branchCounts.length;
                    for (i = 0; i < branchCounts.length; i++) {
                        str += 'BRDA:' + lineNumber +',' + branchId + ',' + i + ',' + (branchCounts[i] > 0 ? branchCounts[i] : '-') + '\n';
                        if (branchCounts[i] > 0) {
                            branchesCovered++;
                        }
                    }

                });

            });
            str += 'BRF:' + totalBranches + '\n';
            str += 'BRH:' + branchesCovered + '\n';

        }

        data.source.forEach(function(line, num) {
            // increase the line number, as JS arrays are zero-based
            num++;

            if (data[num] !== undefined) {
                str += 'DA:' + num + ',' + data[num] + '\n';
                totalLines++;
                if (data[num] > 0) {
                    linesCovered++;
                }
            }
        });

        str += 'LF:' + totalLines + '\n';
        str += 'LH:' + linesCovered + '\n';

        str += 'end_of_record\n';

        return str;
    }

    // this function is invoked by blanket.js when the coverage data is ready.  it will
    // compute per-file coverage info, and send a message to the parent phantomjs process
    // for each file, which the grunt task will use to report passes & failures.
    var reporter = function(coverage, options){

        var fileData = coverage.files;

        var sortedFileNames = [];

        var totals =[];

        for (var filename in fileData) {
            if (fileData.hasOwnProperty(filename)) {
                sortedFileNames.push(filename);
            }
        }

        sortedFileNames.sort();

        var lcov = '';

        for (var i = 0; i < sortedFileNames.length; i++) {
            var thisFile = sortedFileNames[i];
            var data = fileData[thisFile];
            var thisTotal= reportFile( data );
            sendMessage("blanket:fileDone", thisTotal, thisFile);
            lcov += reportLcov(thisFile, data, options);
        }

        sendMessage("blanket:lcov", lcov);
        sendMessage("blanket:done");

    };

    blanket.customReporter = reporter;

})();
