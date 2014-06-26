# Ansijet

_(formerly known as Ansibot, now renamed to avoid being confused with Github's Ansibot)_

[![Build Status](https://secure.travis-ci.org/hiddentao/ansijet.png)](http://travis-ci.org/hiddentao/ansijet)

An [Ansible](http://ansible.com/) playbook automation server.

A node.js server which exposes a simple web API which triggers playbook runs 
when a request is received. This is especially useful if you are unable to run 
Ansible playbooks directly from within your continuous integration environment 
or if you simply wish to trigger playbook runs based on other 
events within your system.

Features:
 * Trigger playbook runs from [different sources](#triggers), including from CI systems such as [Drone](https://github.com/drone/drone).
 * Runs multile playbooks simultaneously, all in separate shell processes
 * Fast, friendly web interface with accompanying [REST API](#rest-api)
 * Highly asynchronous, scalable back-end
 * Full console [log capture](#execution-logs) and storage
 * Get notified of job status through [HipChat](#hipchat)
 


## Installation and startup

**Pre-requisite: Ansible 1.5+**

Installation instructions: http://docs.ansible.com/intro_installation.html.

To ensure you have the latest version it is recommended that you install it 
using `pip`, the Python package manager.

**Pre-requisite: Node.js 0.11.2+**

Installation instructions: [http://nodejs.org/](http://nodejs.org/). 

Ensure the installed version is at least **0.11.2**. Ansijet will not work with 
earlier versions.

_(For Ubuntu users I recommend the [Chris Lea PPA](https://launchpad.net/~chris-lea/+archive/node.js/))_.

**Pre-requisite: MongoDB**

Installation instructions: 

Ansible stores its data in MongoDB. The default configuration expects to be able 
to connect to a MongoDB server running on `127.0.0.1` (i.e. `localhost`).

**Setup your Ansible playbooks**

Place your Ansible playbooks somewhere, e.g. `/playbooks`.

Ansijet expects your playbooks folder to have a certain structure:

```
<playbooks folder>/*.yml   <- your playbooks
<playbooks folder>/hosts   <- Ansible hosts file
```

Ensure that any [`roles`](http://docs.ansible.com/playbooks_roles.html) needed 
by your playbooks can be found by the 
`ansible-playbook` binary. An easy way to ensure this is to store your roles 
within the same folder, i.e. at `<playbooks folder>/roles/`. Ditto for 
`group_vars` and `host_vars` folders.


**Setup Ansijet**

```bash
$ git clone https://github.com/hiddentao/ansijet.git ansijet
$ cd ansijet
$ npm install -g gulp bower
$ npm install
$ bower install
$ npm run build
```

Now create `ansijet/src/config/production.js`:

```javascript
module.exports = function(config) {
  /** Path to folder containg Ansible playbooks */
  config.playbooks = '/playbooks'

  /** Max no. of jobs to execute in parallel. Should match no. of CPU cores. */
  config.jobsInParallel = 1;
};
```

If you look inside `ansijet/src/config/base.js` you will see other 
configuration settings MongoDB, logging, etc. You may 
override these too within the `config/production.js` you created.

**Run Ansijet**

```bash
$ cd ansijet
$ NODE_ENV=production ./start-app.js
```

If you visit `http://localhost:3000` you should see the dashboard showing the 
_Active Jobs_ (there should be none currently).


## Setup playbook automation

Once Ansijet is up and running and you can access the web interface you can view 
the list of Playbooks that Ansijet has found and assign triggers to them.

### Triggers

A trigger is a mechanism which kicks of a playook run when an incoming URL 
request is received. 

Triggers have two purposes:

 1. To perform any necessary additional checks when a request is received to 
 ensure that the request is valid
 2. To supply variables to the Ansible playbook, allowing for playbook execution 
 to be configurable based on the incoming request and the trigger configuration.

All triggers URLs look like `/invoke/<trigger id>?token=<secret token>` with 
additional query parameters depending on the trigger type.

_Note: The `<secret token>` is randomly generated by Ansijet when a trigger is created 
and acts as an additional security check. If the token in an incoming request is 
incorrect Ansijet does not report this to the URL requester - it simply logs 
this fact in the back-end._

At present two trigger types are supported:

**Trigger: Simple**

This exposes a simple URL which triggers a playbook run. It does not 
perform any checks prior to triggering the playbook run. Neither does it supply 
any Ansible playbook variables.

**Trigger: Drone**

This exposes a URL to be called after a successful [Drone](https://github.com/drone/drone) 
build. It supplies the following Ansible variables:

  * `ci_expected_branch`   <- Git branch to run playbook for, configured by user
  * `ci_build_commit`      <- Git commit id, obtained from incoming request
  * `ci_build_branch`      <- Git branch built, obtained from incoming request


### Jobs

When a trigger is invoked it runs a playbook, known as a _Job_. Jobs are 
executed in parallel by 
Ansijet, with the maximum no. of simultaenous jobs determined by the 
`jobsInParallel` configuration parameter set during Ansijet installation. 
Ansijet is also smart enough to ensure that for each playbook, only one instance 
of it is being run at a time.

Each job - i.e. playbook run - takes place in a separate shell process, allowing 
Ansijet to be scaled up according to your machine's cores. Ansijet also 
monitors each shell process such that if no output is received for 5 minutes 
(this time window is configurable) it will kill the shell process 
and assume the playbook run has failed.

When a job is being processed it shows up as an _Active Job_ on your Ansijet 
server's homepage. You can click on it to view the current log output, including 
console log output.


### Execution logs

All logs can be viewed by going to the _Logs_ site section. You can then drill 
down to view the logs pertaining to a particular trigger and/or a particular 
trigger job.



## REST API

Ansijet is built using [Waigo](http://waigojs.com), which means that all the 
URL routes automatically have REST API counterparts. For any given URL, you can 
view REST JSON output by simply appending a `format=json` query parameter when 
making the request. This applies to form submissions too. For more information 
on this [see the Waigo docs](http://waigojs.com/guide.html#views-and-output-formats).


## HipChat

Ansijet can be configured to send notifications to a 
[HipChat](https://hipchat.com) room using the 
[`send_room_notification`](https://www.hipchat.com/docs/apiv2/method/send_room_notification) API.

Simply add the room id and auth token to your configuration file:

```javascript
module.exports = function(config) {
  ...
  config.notifications.hipChat = {
    roomId: <room id>,
    authToken: <auth token for room>
  };
  ...
};
```

When Ansijet first starts up it will send a notification. Subsequent 
notifications will get sent for every job which gets processed.


## Securing Ansijet

Ansijet does not come with any sort of authentication out of the box. Since it's 
running playbooks which most probably affect your servers you will likely want to 
protect access to it.

My setup is to have Ansijet placed behind an Nginx front-end 
server, with SSL and HTTP Basic auth enforced on all incoming requests:

```
server {
  listen 80;
  server_name example.com www.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443;
  server_name example.com www.example.com;

  ssl on;
  ssl_certificate /etc/ssl/certs/server.crt;
  ssl_certificate_key /etc/ssl/private/server.key;
  ssl_session_timeout 5m;

  # Perfect Forward Secrecy
  ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
  ssl_prefer_server_ciphers on;
  ssl_ciphers EECDH+ECDSA+AESGCM:EECDH+aRSA+AESGCM:EECDH+ECDSA+SHA256:EECDH+aRSA+RC4:EDH+aRSA:EECDH:RC4:!aNULL:!eNULL:!LOW:!3DES:!MD5:!EXP:!PSK:!SRP:!DSS;

  root /ansijet/frontend/build;

  location ~ /\. {
    deny all;
  }

  location ~* ^/(css|fonts|img|js)/.+$ {
    gzip_static on;
    gzip_vary on;
    expires 30d;
    add_header Pragma public;
    add_header Cache-Control "public";
  }

  location ~* ^(robots|humans)\.txt$ {
    expires 30d;
    add_header Pragma public;
    add_header Cache-Control "public";
  }

  # If you want to monitor the status of Ansijet and check that it is running 
  # you can call the `/ping` URL. This will output `Ansijet up` is Ansijet is 
  # running
  location = /ping {
    proxy_pass http://127.0.0.1:3000;
  }

  # Everything else needs auth
  location / {
    auth_basic on;
    auth_basic_user_file /ansijet/httpd.auth;
    proxy_pass http://127.0.0.1:3000;
  }

}
```


## Contributing

Though I am already using Ansijet in a production environment it is very much a 
work-in-progress. All suggestions and pull requests are welcome! 

See CONTRIBUTING.md for guidelines.

## License

MIT - see LICENSE.md
