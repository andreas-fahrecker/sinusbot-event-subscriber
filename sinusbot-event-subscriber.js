registerPlugin({
        name: 'Sinusbot-Event-Subsriber',
        version: '0.5',
        description: '',
        author: 'Andreas Fahrecker <andreasfahrecker@gmail.com>',
        vars: [
            {
                name: "DEBUG_LEVEL",
                title: "Debug Level (default is INFO",
                type: "select",
                options: ["ERROR", "WARNING", "INFO", "VERBOSE"],
                default: "2"
            },
            {
                name: "BOT_SERVER_GROUPS",
                title: "Bot Server Group Ids",
                type: "strings"
            }
        ]
    },
    function (_, {DEBUG_LEVEL, BOT_SERVER_GROUPS}, {version}) {
        const engine = require('engine');
        const store = require('store');
        const backend = require('backend');
        const event = require('event');

        const LOG_LEVEL = {
            VERBOSE: 3,
            INFO: 2,
            WARNING: 1,
            ERROR: 0
        };

        /**
         * Logs according to log level
         * @param {number}level - loglevel of this message
         * @param {string}message - message to log
         */
        function log(level, message) {
            if (level <= DEBUG_LEVEL)
                engine.log(message);
        }

        const EventType = {
            JOIN: "JOIN",
            LEAVE: "LEAVE",
            AWAY: "AWAY",
            BACK: "BACK",
            MUTE: "MUTE",
            DEAF: "DEAF",
            TRACK: "TRACK",
            ALL: "ALL"
        };

        /**
         * Returns a description for each event
         * @param {EventType}eventType
         * @returns {string|undefined} returns undefined if an invalid event type is provided
         */
        function eventDescription(eventType) {
            let description = undefined;
            switch (eventType) {
                case EventType.JOIN:
                    description = "Messages you when a user joins the server.";
                    break;
                case EventType.LEAVE:
                    description = "Messages you when a user leaves the server.";
                    break;
                case EventType.AWAY:
                    description = "Messages you when a user sets himself as away.";
                    break;
                case EventType.BACK:
                    description = "Messages you when a user removes himself as away.";
                    break;
                case EventType.MUTE:
                    description = "Messages you when a user mutes or unmutes the microphone.";
                    break;
                case EventType.DEAF:
                    description = "Messages you when a user mutes or unmutes his sound.";
                    break;
                case EventType.TRACK:
                    description = "Messages you when a new track starts.";
                    break;
                case EventType.ALL:
                    description = "Messages you when any event happens.";
                    break;
            }
            return description;
        }

        class SubscriptionStore {
            static storeKey() {
                return "subscriptions";
            }

            constructor() {
                this.updateFromStore();
                this.saveToStore();
                log(LOG_LEVEL.VERBOSE, "VERBOSE: Created new SubscriptionStore.");
            }

            /**
             * Returns if a subscription is already saved
             * @param {Subscription}subscription
             * @returns {boolean} returns true if the subscription is already saved.
             */
            hasSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                return this.getSubscriptions().filter(value => value.equals(subscription)).length > 0;
            }

            /**
             * Adds a subscription to the storage.
             * @param {Subscription} subscription - the subscription which should be stored.
             * @returns {Subscription} returns the added subscription or undefined if it already exists.
             */
            addSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                if (this.hasSubscription(subscription)) {
                    log(LOG_LEVEL.WARNING, "WARNING: Could not create Subscription: " + subscription.getSubscriptionString() + " because it already exists.");
                    return undefined;
                }
                this.updateFromStore();
                this._subscriptions.push(subscription);
                log(LOG_LEVEL.VERBOSE, "VERBOSE: Added Subscription: " + subscription.getSubscriptionString() + " to SubscriptionStore.");
                this.saveToStore();
                log(LOG_LEVEL.INFO, "INFO: Saved and Created new Subscription: '" + subscription.getSubscriptionString() + "'.");
                return subscription;
            }

            /**
             * Returns all Subscription from SubscriptionStore.
             * @returns {Subscription[]}
             */
            getSubscriptions() {
                this.updateFromStore();
                return this._subscriptions.map(value => new Subscription(value));
            }

            /**
             * Returns all Subscriptions of a user.
             * @param {string}uid - the uid of the subscriber
             * @returns {Subscription[]}
             */
            getSubscriptionsOfSubscriber(uid) {
                return this.getSubscriptions().filter(value => value.getSubscriberUId() === uid);
            }

            /**
             * Returns all Subscription for a target uid (including all subscriptions)
             * @param {string}uid - the target uid.
             * @returns {Subscription[]}
             */
            getSubscriptionsForTarget(uid) {
                return this.getSubscriptions().filter(value => value.getTargetUId() === uid || value.getTargetUId() === Subscription.allUId());
            }

            /**
             * Removed a subscription from the storage.
             * @param {Subscription}subscription - the subscription which should be removed.
             * @returns {Subscription} returns the removed subscription or undefined if it doesn't exist.
             */
            deleteSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                if (!this.hasSubscription(subscription)) {
                    log(LOG_LEVEL.WARNING, `WARNING: Could not remove Subscription: ${subscription.getSubscriptionString()} because it doesn't exist.`);
                    return undefined;
                }
                this._subscriptions = this.getSubscriptions().filter(value => !value.equals(subscription));
                log(LOG_LEVEL.VERBOSE, `VERBOSE: Removed Subscription: '${subscription.getSubscriptionString()}' from SubscriptionStore.`);
                this.saveToStore();
                log(LOG_LEVEL.INFO, `INFO: Removed Subscription: '${subscription.getSubscriptionString()}' from Storage.`);
                return subscription;
            }

            updateFromStore() {
                this._subscriptions = store.get(SubscriptionStore.storeKey());
                if (this._subscriptions === undefined) {
                    this._subscriptions = [];
                    log(LOG_LEVEL.INFO, "INFO: Created new Subscription Array because the was none found.");
                } else {
                    log(LOG_LEVEL.VERBOSE, "VERBOSE: Updated SubscriptionStore.");
                }
            }

            saveToStore() {
                store.set(SubscriptionStore.storeKey(), this._subscriptions);
                log(LOG_LEVEL.VERBOSE, "VERBOSE: Saved SubscriptionStore.");
            }
        }

        class Subscription {
            static allUId() {
                return "ALL";
            }

            static validateUId(uid) {
                if (typeof uid !== "string") throw new Error("Expected a string as unique id!");
                if (uid.length !== 28 && uid !== Subscription.allUId()) throw new Error("Unique id should have a length of 28!");
                if (!(/\S{27}=/).test(uid) && uid !== Subscription.allUId()) throw new Error("Unique id " + name + " is not valid!");
                return true;
            }

            static validateEvent(event) {
                if (typeof event !== "string") throw new Error("Expected a string as event");
                if (event.length < 1) throw new Error("Event should have a minimum length of 1!");
                if (Object.keys(EventType).filter(value => value === event).length !== 1) throw new Error("Event is invalid!");
                return true;
            }

            constructor(builder) {
                if (!builder instanceof SubscriptionBuilder) throw new Error("To create a new subscription use the subscription builder!");
                this._subscriberUId = builder._subscriberUId;
                this._eventType = builder._eventType;
                this._targetUId = builder._targetUId;
            }

            getSubscriberUId() {
                return this._subscriberUId;
            }

            getEventType() {
                return this._eventType;
            }

            getTargetUId() {
                return this._targetUId;
            }

            getSubscriptionString() {
                return this.getSubscriberUId() + " | " + this.getEventType() + " | " + this.getTargetUId();
            }

            equals(other) {
                if (!other instanceof Subscription) return false;
                return this.getSubscriberUId() === other.getSubscriberUId() && this.getEventType() === other.getEventType() && this.getTargetUId() === other.getTargetUId();
            }
        }

        class SubscriptionBuilder {
            constructor() {
            }

            setSubscriberUId(subscriberUId) {
                if (Subscription.validateUId(subscriberUId)) this._subscriberUId = subscriberUId;
                return this;
            }

            setEvent(event) {
                if (Subscription.validateEvent(event)) this._eventType = event;
                return this;
            }

            setTargetUId(targetUId) {
                if (Subscription.validateUId(targetUId)) this._targetUId = targetUId;
                return this;
            }

            build() {
                if (!Subscription.validateUId(this._subscriberUId) && !Subscription.validateEvent(this._eventType) && !Subscription.validateUId(this._targetUId)) throw new Error("The subscriber uid, event and the target uid have to be set");
                if (this._subscriberUId === this._targetUId) throw new Error("The target uid cannot be the same uid as the subscriber uid.");
                return new Subscription(this);
            }
        }

        const HelperFunctions = {
            /**
             * Converts a Nickname to a uid.
             * @param {string}nickname
             * @returns {string|undefined} Returns undefined if no uid was found.
             */
            nicknameToUId: (nickname) => {
                const user = backend.getClients().filter(u => u.name() === nickname);
                return user.length > 0 ? user[0].uid() : undefined;
            },
            /**
             * Converts a uid to a Nickname
             * @param {string}uid
             * @returns {string|undefined} Returns if no nickname was found.
             */
            uidToNickname: (uid) => {
                const user = backend.getClients().filter(u => u.uid() === uid);
                return user.length > 0 ? user[0].name() : undefined;
            },
            /**
             * Returns if a uid belongs to a bot client it the bot client is online
             * @param {string}uid
             * @returns {boolean}
             */
            uidIsBotClient: (uid) => {
                const user = backend.getClientByUID(uid);
                if (user != null) {
                    let serverGroups = user.getServerGroups();
                    serverGroups = serverGroups.filter(value => BOT_SERVER_GROUPS.includes(value.id()));
                    if (serverGroups.length > 0) {
                        return true;
                    }
                } else {
                    return false;
                }
            },
            /**
             * Add or Removes a subscription from the storage and replies to the client
             * @param client
             * @param args
             * @param reply
             * @param {boolean}sub
             */
            addOrRemoveSubscription: (client, args, reply, sub) => {
                let uid, nickname;
                let commandPossible = false;
                if (args.targetUId !== undefined && args.targetUId !== "" && args.targetNickname !== undefined && args.targetNickname !== "") {
                    reply("You should provide a targetNickname or a targetUId.");
                    reply("You can use a Nickname when your target is online or the uid if your target is offline.");
                }
                if ((args.targetUId === undefined || args.targetUId === "") && args.targetNickname !== undefined && args.targetNickname !== "") {
                    uid = args.targetNickname !== Subscription.allUId() ? HelperFunctions.nicknameToUId(args.targetNickname) : Subscription.allUId();
                    nickname = args.targetNickname;
                    if (args.event.toUpperCase() === EventType.TRACK) {
                        commandPossible = HelperFunctions.uidIsBotClient(uid);
                    }
                    commandPossible = true;
                }
                if (args.targetUId !== undefined && args.targetUId !== "" && (args.targetNickname === undefined || args.targetNickname === "")) {
                    uid = args.targetUId;
                    nickname = HelperFunctions.uidToNickname(uid);
                    commandPossible = true;
                }
                //If Event is Track check if target is bot
                if (commandPossible && args.event.toUpperCase() === EventType.TRACK) {
                    commandPossible = HelperFunctions.uidIsBotClient(uid);
                }
                if (uid !== undefined && commandPossible) {
                    try {
                        let subscription = new SubscriptionBuilder().setSubscriberUId(client.uid()).setEvent(args.event.toUpperCase()).setTargetUId(uid).build();
                        subscription = sub ? subscriptionStore.addSubscription(subscription) : subscriptionStore.deleteSubscription(subscription);
                        if (subscription !== undefined) {
                            const subTxt = `You just ${sub ? "" : "un"}subscribed to the ${subscription.getEventType()} event of ${(nickname !== undefined && nickname !== "") ? nickname : uid}`;
                            reply(subTxt);
                        } else {
                            reply(sub ? "You couldn't make this subscription, maybe there was an error or you already have this subscription." : "You couldn't remove this subscription, maybe you aren't subscribed.");
                        }
                    } catch (e) {
                        log(LOG_LEVEL.ERROR, e.message);
                        reply("Sorry an Error occurred: " + e.message);
                    }
                }
            },
            /**
             * Messages all Subscribers of an event.
             * @param {Client}targetClient - the target client.
             * @param {string}eventType - the type of the event.
             * @param {string}message - the message the subscriber should receive.
             */
            messageSubscribers: (targetClient, eventType, message) => {
                const subscriptions = subscriptionStore.getSubscriptionsForTarget(targetClient.uid())
                    .filter(value => value.getEventType() === eventType || value.getEventType() === EventType.ALL);
                const messagedSubscribers = [];
                subscriptions.forEach(value => {
                    if (!messagedSubscribers.includes(value.getSubscriberUId())) {
                        const subscriber = backend.getClientByUID(value.getSubscriberUId());
                        if (subscriber != null) {
                            subscriber.chat(message);
                            messagedSubscribers.push(subscriber.uid());
                        }
                    }
                });
            }
        };

        const subscriptionStore = new SubscriptionStore();

        event.on("load", () => {
            const command = require("command");
            if (!command) throw new Error("command.js library not found! Please download command.js and enable it to be able to use this script!");

            const sesCommand = command.createCommandGroup("ses")
                .help("This script allows users to subscribe to events.");

            let eventListWithDescriptions = "";
            Object.keys(EventType).forEach(value => eventListWithDescriptions += "[B]" + value.toLowerCase() + "[/B] - " + eventDescription(value) + "\n");

            sesCommand.addCommand("subs")
                .help("Shows your subscriptions.")
                .manual("Shows your subscriptions.")
                .manual("You can filter for event types.")
                .manual(`Possible events are: [B]${Object.keys(EventType).map(value => value.toLowerCase())}[/B]`)
                .manual(eventListWithDescriptions)
                .addArgument(args => args.string.setName("event").whitelist(Object.keys(EventType).map(value => value.toLowerCase())).optional(undefined))
                .exec((client, args, reply) => {
                    let subsTxT = "Nick / Uid | EventType\n-------------------------\n";
                    const subscriptions = args.event === undefined ?
                        subscriptionStore.getSubscriptionsOfSubscriber(client.uid()) :
                        subscriptionStore.getSubscriptionsOfSubscriber(client.uid()).filter(value => value.getEventType() === args.event.toUpperCase() || value.getEventType() === EventType.ALL);
                    if (subscriptions.length > 0) {
                        subscriptions.forEach(value => {
                            const nick = HelperFunctions.uidToNickname(value.getTargetUId());
                            subsTxT += (nick ? nick : value.getTargetUId()) + " | " + value.getEventType() + "\n"
                        });
                        reply("Subscriptions\n" + subsTxT);
                    } else {
                        reply("Sorry you currently don't have any subscriptions.");
                    }
                });

            sesCommand.addCommand("sub")
                .help("Lets you subscribe to an event.")
                .manual("Lets you subscribe to an event.")
                .manual(`Possible events are: [B]${Object.keys(EventType).map(value => value.toLowerCase())}[/B]`)
                .manual("You have to either provide a target [B]nickname[/B] or [B]uid[/B].")
                .manual("If you want to subscribe to all events of that type, you can provide [B]ALL[/B] as the targetNickname.")
                .manual("You can use the nickname only if the target is online")
                .manual("If you want to subscribe to track, you have to use a bot client as target.")
                .manual(eventListWithDescriptions)
                .addArgument(args => args.string.setName("event").whitelist(Object.keys(EventType).map(value => value.toLowerCase())))
                .addArgument(args => args.string.setName("targetUId").match(/\S{27}=/).optional(undefined))
                .addArgument(args => args.string.setName("targetNickname").optional(undefined))
                .exec((client, args, reply) => {
                    HelperFunctions.addOrRemoveSubscription(client, args, reply, true);
                });

            sesCommand.addCommand("unsub")
                .help("Lets you unsubscribe from an event.")
                .manual("Lets you unsubscribe from an event.")
                .manual(`Possible events are: [B]${Object.keys(EventType).map(value => value.toLowerCase())}[/B]`)
                .manual("You have to either provide a target [B]nickname[/B] or [B]uid[/B].")
                .manual("If you want to subscribe to all events of that type, you can provide [B]ALL[/B] as the targetNickname.")
                .manual("You can use the nickname only if the target is online")
                .manual("If you want to subscribe to track, you have to use a bot client as target.")
                .manual(eventListWithDescriptions)
                .addArgument(args => args.string.setName("event").whitelist(Object.keys(EventType).map(value => value.toLowerCase())))
                .addArgument(args => args.string.setName("targetUId").match(/\S{27}=/).optional(undefined))
                .addArgument(args => args.string.setName("targetNickname").optional(undefined))
                .exec((client, args, reply) => {
                    HelperFunctions.addOrRemoveSubscription(client, args, reply, false);
                });

            sesCommand.addCommand("users")
                .help("Shows all online users.")
                .exec((client, args, reply) => {
                    let usersTxT = "Nickname | Uid\n-------------------------\n";
                    const users = backend.getClients();
                    users.forEach(user => {
                        usersTxT += user.name() + " | " + user.uid() + "\n"
                    });
                    reply(usersTxT);
                });
        });

        event.on('clientMove', function (ev) {
            if (ev.fromChannel == null) {
                log(LOG_LEVEL.VERBOSE, "VERBOSE: A client joined the server.");
                HelperFunctions.messageSubscribers(ev.client, EventType.JOIN, `${ev.client.name()} just joined the server.`);
            }
            if (ev.toChannel == null) {
                log(LOG_LEVEL.VERBOSE, "VERBOSE: A client left the server.");
                HelperFunctions.messageSubscribers(ev.client, EventType.LEAVE, `${ev.client.name()} just left the server.`);
            }
        });

        event.on('clientAway', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client went away.");
            HelperFunctions.messageSubscribers(ev, EventType.AWAY, `${ev.name()} went away.`);
        });

        event.on('clientBack', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client got back.");
            HelperFunctions.messageSubscribers(ev, EventType.BACK, `${ev.name()} got back.`);
        });

        event.on('clientMute', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client muted his microphone.");
            HelperFunctions.messageSubscribers(ev, EventType.MUTE, `${ev.name()} has muted his microphone.`);
        });

        event.on('clientUnmute', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client unmuted his microphone.");
            HelperFunctions.messageSubscribers(ev, EventType.MUTE, `${ev.name()} has unmuted his microphone.`);
        });

        event.on('clientDeaf', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client muted his sound.");
            HelperFunctions.messageSubscribers(ev, EventType.DEAF, `${ev.name()} has muted his sound.`);
        });

        event.on('clientUndeaf', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A client unmuted his sound.");
            HelperFunctions.messageSubscribers(ev, EventType.DEAF, `${ev.name()} has unmuted his sound.`);
        });

        event.on('track', ev => {
            log(LOG_LEVEL.VERBOSE, "VERBOSE: A new track has started.");
            const botClient = backend.getBotClient();
            HelperFunctions.messageSubscribers(botClient, EventType.TRACK, `${ev.title()} has started playing on ${botClient.name()}`)
        });
    }
);