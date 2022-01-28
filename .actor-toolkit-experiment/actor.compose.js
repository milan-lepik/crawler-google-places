const fs = require('fs')
const jsonc = require('jsonc-parser')
const dotActorRoot = '../.actor/'

const actorJson = JSON.parse(jsonc.stripComments(fs.readFileSync(dotActorRoot + './actor.json').toString()))
function compose(actorJson) {
    const actorMinJson = {}
    let continueRecursion = false
    Object.keys(actorJson).forEach((key) => {
        if (typeof actorJson[key] === "string" && actorJson[key].match(/\.json/)) {
            actorMinJson[key] = JSON.parse(jsonc.stripComments(fs.readFileSync(dotActorRoot + actorJson[key]).toString()))
            continueRecursion = true
        } else if (typeof actorJson[key] === "object" && !Array.isArray(actorJson[key])) {
            actorMinJson[key] = compose(actorJson[key])
        } else {
            actorMinJson[key] = actorJson[key]
        }
    })

    if (continueRecursion) {
        return compose(actorMinJson)
    }
    return actorMinJson
}
fs.writeFileSync(dotActorRoot+'actor.composed.json', JSON.stringify(compose(actorJson)))