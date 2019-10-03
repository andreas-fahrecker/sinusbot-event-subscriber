Sinusbot-Event-Subscriber
=
Sinusbot-Event-Subscriber is a script for Sinusbot.
It contains a set of commands which can be viewed with '!man ses'.
With these commands a user can subscribe to a collection of events and be notified of them.

# Installation and Configuration
- To install the sinusbot-event-subscriber you only have to put the sinusbot-event-subscriber.js file into you scripts directory.
- You also have to install command.js.
- After you have installed the script you can set the log level of the script (optional).
- Then you have to set the server group id's of the bot server groups.

# Commands
- !ses subs [event] - Shows your subscriptions.
- !ses sub <event> [targetUId] [targetNickname] - Lets you subscribe to an event.
- !ses unsub <event> [targetUId] [targetNickname] - Lets you unsubscribe from an event.
- !ses users - Shows all online users.

# Usage

## Subs
- !ses subs [event]

Shows your subscriptions. 
You can filter for event types. 
Possible events are: **join**,**leave**,**away**,**back**,**mute**,**deaf**,**track**,**all** 

## Sub
- !ses sub <event> [targetUId] [targetNickname]

Lets you subscribe to an event. 
Possible events are: **join**,**leave**,**away**,**back**,**mute**,**deaf**,**track**,**all** 

You have to either provide a target nickname or uid. 
If you want to subscribe to all events of that type, you can provide ALL as the targetNickname. 
You can use the nickname only if the target is online.
If you want to subscribe to track, you have to use a bot client as target.

## Unsub
- !ses unsub <event> [targetUId] [targetNickname]

Lets you unsubscribe from an event. 
Possible events are: **join**,**leave**,**away**,**back**,**mute**,**deaf**,**track**,**all**

You have to either provide a target nickname or uid. 
If you want to subscribe to all events of that type, you can provide ALL as the targetNickname. 
You can use the nickname only if the target is online 
If you want to subscribe to track, you have to use a bot client as target. 

## Users
- !ses users
 
Shows all online users.

# Events
- **join** - Messages you when a user joins the server.
- **leave** - Messages you when a user leaves the server.
- **away** - Messages you when a user sets himself as away.
- **back** - Messages you when a user removes himself as away.
- **mute** - Messages you when a user mutes or unmutes the microphone.
- **deaf** - Messages you when a user mutes or unmutes his sound.
- **track** - Messages you when a new track starts.
- **all** - Messages you when any event happens.
