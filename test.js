'use strict';

const fs = require('fs');

process.stdin.resume();
process.stdin.setEncoding('utf-8');

let inputString = '';
let currentLine = 0;

process.stdin.on('data', function(inputStdin) {
    inputString += inputStdin;
});

process.stdin.on('end', function() {
    inputString = inputString.split('\n');

    main();
});

function readLine() {
    return inputString[currentLine++];
}


/*
 * Complete the 'minCost' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts 2D_INTEGER_ARRAY cost as parameter.
 */

function minCost(cost) {
    // Write your code here
    let res = 0;
    const min = Math.min(...cost[0]);
    const pos = (cost[0]).indexOf(min);
    res += min;
    for (let i = 1; i < cost.length; i++) {
        for (let j = 0; j < cost[0].length; j++) {
            const min = Math.min(...cost);
        }
    }

}

function main() {
}
