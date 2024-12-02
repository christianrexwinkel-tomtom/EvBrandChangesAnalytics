var request = require("request");
var fs = require("fs");

function readSummaryData(url) {
    return new Promise((resolve, reject) => {
        request(
            {
                method: "get",
                url: url,
                headers: { "accept": "*/*", "content-type": "application/json" },
            },
            function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            }
        );
    });
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findOperators(data) {
    const operators = {};

    for (let i = 0; i < data.summary.length; i++) {
        country = data.summary[i];

        if(Array.isArray(country.operators)) {
            country.operators.forEach(operator => {
                const key = `${operator.id}_${country.countryCode}`;
                operators[key] = { name: `${operator.name}_${country.countryCode}` };        
            });
        }
    }

    return operators;
}

function findDifferences(oldData, newData) {
    const differences = {
        operatorIdSameNameChanged: [],
        operatorIdChangedNameSame: [],
        operatorNew: [],
        operatorRemoved: []
    };

    const oldOperators = findOperators(oldData);
    const newOperators = findOperators(newData);

    // Check for differences in old operators
    Object.entries(oldOperators).forEach(([oldId, oldOperator]) => {
        const newOperator = newOperators[oldId];
        
        if (newOperator) {
            // Same ID, check for name change
            if (oldOperator.name !== newOperator.name) {
                differences.operatorIdSameNameChanged.push({
                    id: oldId.split('_')[0],
                    oldName: oldOperator.name.split('_')[0],
                    newName: newOperator.name.split('_')[0],
                    countryCode: oldId.split('_')[1]
                });
            }
            // Remove from newOperators to avoid processing it again
            delete newOperators[oldId];
        }
        else {
            // Operator no longer exists
            differences.operatorRemoved.push({
                id: oldId.split('_')[0],
                name: oldOperator.name.split('_')[0],
                countryCode: oldId.split('_')[1]
            })
        }
    });

    // Check remaining new operators for changed IDs or names
    Object.entries(newOperators).forEach(([newId, newOperator]) => {

        const [oldId, oldOperator] = Object.entries(oldOperators).find(
            ([, value]) => value.name === newOperator.name
        ) || [null, null];       
        
        if (oldOperator) {
            differences.operatorIdChangedNameSame.push({
                oldId: oldId.split('_')[0],
                newId: newId.split('_')[0],
                name: newOperator.name.split('_')[0],
                countryCode: oldId.split('_')[1]
            });
        } else {
            differences.operatorNew.push({              
                id: newId.split('_')[0],
                name: newOperator.name.split('_')[0],
                countryCode: newId.split('_')[1]
            });
        }
    });

    return differences;
}

const baselineData = readJsonFile(
    'test_resources/response.json');
const newData = readSummaryData(
    "https://api.tomtom.com/epp/bulkaccess/api/summary?key=" + process.argv[2])
    .then(data => {
        fs.writeFileSync('test_resources/responseNew.json', data);

        const newData = JSON.parse(data);
        const differences = findDifferences(baselineData, newData);
        console.log(JSON.stringify(differences));
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });