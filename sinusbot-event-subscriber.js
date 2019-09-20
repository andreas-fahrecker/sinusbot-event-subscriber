registerPlugin({
        name: 'Sinusbot-Event-Subsriber',
        version: '0.1',
        description: '',
        author: 'Andreas Fahrecker <andreasfahrecker@gmail.com>',
        vars: [
            {
                name: "DEBUG_LEVEL",
                title: "Debug Level (default is INFO",
                type: "select",
                options: ["ERROR", "WARNING", "INFO", "VERBOSE"],
                default: "2"
            }
        ]
    },
    function (_, {DEBUG_LEVEL}, {version}) {
        const engine = require('engine');
        const store = require('store');
        const backend = require('backend');
        const event = require('event');

        function DEBUG(level) {
            return mode => (...args) => {
                if (mode) return;
                engine.log(...args);
            }
        }

        DEBUG.VERBOSE = 3;
        DEBUG.INFO = 2;
        DEBUG.WARNING = 1;
        DEBUG.ERROR = 0;
        const debugLog = DEBUG(parseInt(DEBUG_LEVEL, 10));

        const EventType = {
            JOIN: "JOIN"
        };

        const storeKeySubscriptions = "subscriptions";

        const allUid = "ALL";
        const joinEvent = "join";

        class SubscriptionStore {
            static storeKey() {
                return "subscriptions";
            }

            constructor() {
                let subscriptions = store.get(SubscriptionStore.storeKey());
                if (subscriptions === undefined) {
                    subscriptions = [];
                    debugLog(DEBUG.INFO)("INFO: Created new Subscription Array because the was none found.");
                }
                this._subscriptions = subscriptions;
                debugLog(DEBUG.VERBOSE)("Created new SubscriptionStore.");
            }

            /**
             * Returns if a subscription is already saved
             * @param {Subscription}subscription
             */
            hasSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                return this.getSubscriptions().filter(value => value.equals(subscription)).length < 1;
            }

            /**
             * Adds a subscription to the storage.
             * @param {Subscription} subscription - the subscription which should be stored.
             * @returns {Subscription} returns the added subscription or undefined if it already exists
             */
            addSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                if (this.hasSubscription(subscription)) {
                    return undefined;
                }
                this.updateFromStore();
                this._subscriptions.push(subscription);
                this.saveToStore();
                debugLog(DEBUG.INFO)("INFO: Saved and Created new Subscription: '" + subscription.getSubscriptionString() + "'");
                return subscription;
            }

            /**
             * Returns all Subscription from SubscriptionStore.
             * @returns {Subscription[]}
             */
            getSubscriptions() {
                this.updateFromStore();
                return this._subscriptions.map(value => value = new Subscription(value));
            }

            /**
             * Removed a subscription from the storage.
             * @param {Subscription}subscription - the subscription which should be removed.
             */
            deleteSubscription(subscription) {
                if (!subscription instanceof Subscription) throw new Error("Expected a Subscription");
                if (!this.hasSubscription(subscription)) {
                    debugLog(DEBUG.WARNING)("WARNING: trying to delete a non existing subscription!");
                    debugLog(DEBUG.WARNING)("WARNING: Sinusbot-Event-Subscriber may not work as expected!");
                }
                this._subscriptions = this.getSubscriptions().filter(value => !value.equals(subscription));
                debugLog(DEBUG.VERBOSE)("VERBOSE: Removed Subscription: '" + subscription.getSubscriptionString() + "' from SubscriptionStore.");
                this.saveToStore();
                debugLog(DEBUG.INFO)("INFO: Removed Subscription: '" + subscription.getSubscriptionString() + "' from Storage.");
            }

            updateFromStore() {
                this._subscriptions = store.get(SubscriptionStore.storeKey());
                debugLog(DEBUG.VERBOSE)("VERBOSE: Updated SubscriptionStore.");
            }

            saveToStore() {
                store.set(SubscriptionStore.storeKey(), this._subscriptions);
                debugLog(DEBUG.VERBOSE)("VERBOSE: Saved SubscriptionStore.");
            }
        }

        class Subscription {
            static validateUId(uid) {
                if (typeof uid !== "string") throw new Error("Expected a string as unique id!");
                if (uid.length === 27) throw new Error("Unique id should have a length of 27!");
                if (!(/\S{27}=/).test(uid)) throw new Error("Unique id " + name + " is not valid!");
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
                return this.getSubscriberUId() + ":" + this.getEventType() + ":" + this.getTargetUId();
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
            }
        };

        const subscriptionStore = new SubscriptionStore();

        event.on("load", () => {
            const command = require("command");
            if (!command) throw new Error("command.js library not found! Please download command.js and enable it to be able to use this script!");

            const sesCommand = command.createCommandGroup("ses")
                .help("This script allows users to subscribe to the online status of another user.");

            sesCommand.addCommand("subscriptions")
                .alias("subs")
                .help("Shows all your subscription.")
                .exec((client, args, reply) => {
                    let subsTxT = "Nick / Uid | EventType\n-------------------------\n";
                    subscriptionStore.getSubscriptions().forEach(value => {
                        if (value.getSubscriberUId() === client.uid()) {
                            const nick = HelperFunctions.uidToNickname(value.getTargetUId());
                            subsTxT += (nick ? nick : value.getTargetUId()) + " | " + value.getEventType() + "\n"
                        }
                    });
                    reply("Subscriptions\n" + subsTxT);
                });

            sesCommand.addCommand("subscribe")
                .alias("sub")
                .help("Lets you subscribe to an event. " + Object.keys(EventType))
                .addArgument(args => args.string.setName("event").whitelist(Object.keys(EventType).map(value => value.toLowerCase())))
                .addArgument(args => args.string.setName("targetUId").match(/\S{27}=/).optional(undefined))
                .addArgument(args => args.string.setName("targetNickname").optional(undefined))
                .exec((client, args, reply) => {
                    if (args.event === EventType.JOIN.toLowerCase()) {
                        let uid, nickname;
                        if (args.targetUId !== undefined && args.targetUId !== "" && args.targetNickname !== undefined && args.targetNickname !== "") {
                            reply("You should provide a targetNickname or a targetUId.");
                            reply("You can use a Nickname when your target is online or the uid if your target is offline.");
                        }
                        if ((args.targetUId === undefined || args.targetUId === "") && args.targetNickname !== undefined && args.targetNickname !== "") {
                            uid = HelperFunctions.nicknameToUId(args.targetNickname);
                            nickname = args.targetNickname;
                        }
                        if (args.targetUId !== undefined && args.targetUId !== "" && (args.targetNickname === undefined || args.targetNickname === "")) {
                            uid = args.targetUId;
                            nickname = HelperFunctions.uidToNickname(uid);
                        }
                        if (uid !== undefined) {
                            const subscription = subscriptionStore.addSubscription(new SubscriptionBuilder().setEvent(EventType.JOIN).setSubscriberUId(client.uid()).setTargetUId(uid).build());
                            if (subscription !== undefined) {
                                const subTxt = "You just subscribed to the " + EventType.JOIN + " event of " + ((nickname !== undefined && nickname !== "") ? nickname : uid);
                                reply(subTxt);
                                reply(JSON.stringify(subscription));
                            } else {
                                reply("You couldn't make this subscription, maybe there was an error or you already have this subscription");
                            }
                        }
                    }
                });

            sesCommand.addCommand("unsubscribe")
                .alias("unsub")
                .help("Lets you unsubscribe from an event.")
                .addArgument(args => args.string.setName("event").whitelist(Object.keys(EventType)))
                .addArgument(args => args.string.setName("targetUId").match(/\S{27}=/).optional(undefined))
                .addArgument(args => args.string.setName("targetNickname").optional(undefined))
                .exec((client, args, reply) => {
                    reply(args);
                });

            sesCommand.addCommand("users")
                .help("Shows all online users.")
                .exec((client, args, reply) => {
                    let usersTxT = "Nickname | Uid\n-------------------------\n";
                    const users = backend.getClients();
                    users.forEach(user => {
                        debugLog(DEBUG.VERBOSE)(user);
                        usersTxT += user.name() + " | " + user.uid() + "\n"
                    });
                    reply(usersTxT);
                });
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