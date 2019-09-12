registerPlugin({
        name: 'Sinusbot-Onlinestatus-Subsriber',
        version: '1.0',
        description: '',
        author: 'Andreas Fahrecker <andreasfahrecker@gmail.com>',
        vars: []
    },
    function (_, config, meta) {
        const engine = require('engine');
        const store = require('store');
        const backend = require('backend');
        const event = require('event');

        const commandPrefix = engine.getCommandPrefix() + 'oss';

        const allUid = "ALL";
        const joinEvent = "join";

        class Subscription {
            constructor(subscriber, eventType, uid) {
                const users = backend.getClients();
                let valid = true;
                if (eventType !== joinEvent) valid = false;
                if (valid) {
                    let subFound = false;
                    for (let user of users) {
                        if (user.uid() === subscriber) {
                            subFound = true;
                            break;
                        }
                    }
                    if (!subFound) valid = false;
                }
                if (valid) {
                    this.subscriber = subscriber;
                    this.eventType = eventType;
                    this.uid = uid;
                } else {
                    new Error('Subscription is invalid')
                }
            }
        }

        function nickToUid(nick) {
            const users = backend.getClients();
            let uid;
            for (let user of users) {
                if (user.nick() === nick) {
                    uid = user.uid();
                    break;
                }
            }
            return uid;
        }

        function uidToNick(uid) {
            const users = backend.getClients();
            let nick;
            for (let user of users) {
                if (user.uid() === uid) {
                    nick = user.nick();
                    break;
                }
            }
            return nick;
        }

        const stringsTxT = "(strings habe to be enclosed by \" )";
        const scriptHelp =
            "This script allows users to subscribe to the online status of another user.\n" +
            "Usage: " + commandPrefix + " <command> [<args>]\n" +
            "Commands:\n" +
            "  help - shows infos about the available commands\n" +
            "  sub|subscribe - lets you subscribe to an event\n" +
            "  subs|subscriptions - lets you see all your subscriptions\n" +
            "  users - lets you list all users"
        ;
        const subCommandHelp =
            "This command allows you to subscribe to an event.\n" +
            "There are different types of events you can subscribe to.\n" +
            "  " + joinEvent + " - messages you when a user joins the server";
        const subsCommandHelp = "This command lists all your subscriptions.";
        const unsubCommandHelp = "This command lets you unsubscribe from an event.";
        const usersCommandHelp = "This command lists a the online users with nicknames and uids.";
        const joinEventHelp =
            "This event messages you when a user joins the server.\n" +
            "To subscribe to a user you either by a uid or when the user is online by a nickname.\n" +
            "  --nickname=<string> - To provide a nickname of a online user " + stringsTxT + ")\n" +
            "  --uid=<string> - To provide a uid of a user " + stringsTxT + "\n" +
            "  --all - To subscribe to all users";

        const storeKeySubscriptions = "subscriptions";
        if (store.get(storeKeySubscriptions) == null) {
            store.set(storeKeySubscriptions, []);
        }

        event.on('chat', ev => {
            const client = ev.client;
            if (ev.text.startsWith(commandPrefix)) {
                const cmdRegex = new RegExp("^\\" + commandPrefix + " *");
                const helpRegex = new RegExp("help");
                // TODO check if sub exists
                const subRegex = new RegExp("(sub|subscribe)");
                //TODO
                const unsubRegex = new RegExp("(unsub|unsubscribe)");
                const subsRegex = new RegExp("(subs|subscriptions)");
                const usersRegex = new RegExp("users");
                const joinRegex = new RegExp(joinEvent);
                const nickRegex = new RegExp("--nickname=\"[^\"]+\"");
                const uidRegex = new RegExp("--uid=\"[^\"]+\"");
                const allRegex = new RegExp("--all");
                const command = ev.text.replace(cmdRegex, '');
                client.chat('Received command :\'' + command + '\'');
                if (helpRegex.test(command) || command === '') {
                    if (subsRegex.test(command)) {
                        client.chat(subsCommandHelp);
                    } else if (unsubRegex.test(command)) {
                        client.chat(unsubCommandHelp);
                    } else if (subRegex.test(command)) {
                        if (joinRegex.test(command)) {
                            client.chat(joinEventHelp);
                        } else {
                            client.chat(subCommandHelp);
                        }
                    } else if (usersRegex.test(command)) {
                        client.chat(usersCommandHelp);
                    } else {
                        client.chat(scriptHelp);
                    }

                } else if (subsRegex.test(command)) {
                    let subsTxT = "Nick / Uid | EventType\n-------------------------\n";
                    const subs = store.get(storeKeySubscriptions);
                    subs.forEach(sub => {
                        if (sub.subscriber === client.uid()) {
                            const nick = uidToNick(sub.uid);
                            subsTxT += (nick ? nick : sub.uid) + " | " + sub.eventType + "\n"
                        }
                    });
                    client.chat("Subscriptions\n" + subsTxT);
                } else if (subRegex.test(command)) {
                    client.chat("Subscribe");
                    if (joinRegex.test(command)) {
                        client.chat(command);
                        const nickHit = command.match(nickRegex);
                        const uidHit = command.match(uidRegex);
                        const allHit = command.match(allRegex);
                        if (nickHit) {
                            const nick = nickHit.map(value => value.replace("--nickname=\"", "").replace("\"", ""))[0];
                            const uid = nickToUid(nick);
                            const subscription = new Subscription(client.uid(), joinEvent, uid);
                            const subs = store.get(storeKeySubscriptions);
                            subs.push(subscription);
                            store.set(storeKeySubscriptions, subs);
                            client.chat("You subscribed to the join event of " + nick + ".");
                        } else if (uidHit) {
                            const uid = uidHit.map(value => value.replace("--uid=\"", "").replace("\"", ""))[0];
                            const subscription = new Subscription(client.uid(), joinEvent, uid);
                            const subs = store.get(storeKeySubscriptions);
                            subs.push(subscription);
                            store.set(storeKeySubscriptions, subs);
                            const nick = uidToNick(uid);
                            client.chat("You subscribed to the join event of " + (nick ? nick : uid) + ".");
                        } else if (allHit) {
                            const subscription = new Subscription(client.uid(), joinEvent, allUid);
                            const subs = store.get(storeKeySubscriptions);
                            subs.push(subscription);
                            store.set(storeKeySubscriptions, subs);
                            client.chat("You subscribed to all join events");
                        } else {
                            client.chat(joinEventHelp);
                        }
                    } else {
                        client.chat(subCommandHelp);
                    }
                } else if (usersRegex.test(command)) {
                    let usersTxT = "Nickname | Uid\n-------------------------\n";
                    const users = backend.getClients();
                    users.forEach(user => usersTxT += user.nick() + " | " + user.uid() + "\n");
                    client.chat("Users\n" + usersTxT);
                }
            }
        });
        event.on('clientMove', function (ev) {
            if (ev.fromChannel == null) {
                const joinedClient = ev.client;
                const subs = store.get(storeKeySubscriptions);
                const messagedSubscribers = [];
                subs.filter(sub => sub.uid === allUid).forEach(sub => {
                    const subscriber = backend.getClientByID(sub.subscriber);
                    if (subscriber != null) {
                        subscriber.chat(joinedClient.nick() + " just joined the server.");
                        messagedSubscribers.push(subscriber.uid());
                    }
                });
                subs.filter(sub => !messagedSubscribers.includes(sub.uid)).forEach(sub => {
                    if ((sub.uid === joinedClient.uid()) && sub.eventType === joinEvent) {
                        const subscriber = backend.getClientByUID(sub.subscriber);
                        if (subscriber != null) {
                            subscriber.chat(joinedClient.nick() + " just joined the server.");
                        }
                    }
                });
            }
        });
    }
)
;