# fs-admin

[![Build Status](https://travis-ci.org/atom/fs-admin.svg?branch=master)](https://travis-ci.org/atom/fs-admin)
[![Build status](https://ci.appveyor.com/api/projects/status/5c5gpb9idn1xcw1y/branch/master?svg=true)](https://ci.appveyor.com/project/Atom/fs-admin/branch/master)

Perform file system operations with administrator privileges.

## Installing

```sh
npm install fs-admin
```

## Packaging (Linux only)

This library uses [PolicyKit](https://wiki.archlinux.org/index.php/Polkit) to escalate privileges when calling `createWriteStream(path)` on Linux. In particular, it will invoke `pkexec dd of=path` to stream the desired bytes into the specified location.

### PolicyKit

Not all Linux distros may include PolicyKit as part of their standard installation. As such, it is recommended to make it an explicit dependency of your application package. The following is an example Debian control file that requires `policykit-1` to be installed as part of `my-application`:

```
Package: my-application
Version: 1.0.0
Depends: policykit-1
```

### Policies

When using this library as part of a Linux application, you may want to install a [Policy](https://wiki.archlinux.org/index.php/PolicyKit#Actions) as well. Although not mandatory, policy files allow customizing the behavior of `pkexec` by e.g., displaying a custom password prompt or retaining admin privileges for a short period of time:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE policyconfig PUBLIC
 "-//freedesktop//DTD PolicyKit Policy Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/PolicyKit/1.0/policyconfig.dtd">
<policyconfig>
  <vendor>Your Application Name</vendor>
  <action id="my-application.pkexec.dd">
    <description gettext-domain="my-application">Admin privileges required</description>
    <message gettext-domain="my-application">Please enter your password to save this file</message>
    <annotate key="org.freedesktop.policykit.exec.path">/bin/dd</annotate>
    <annotate key="org.freedesktop.policykit.exec.allow_gui">true</annotate>
    <defaults>
      <allow_any>auth_admin_keep</allow_any>
      <allow_inactive>auth_admin_keep</allow_inactive>
      <allow_active>auth_admin_keep</allow_active>
    </defaults>
  </action>
</policyconfig>
```

Policy files should be installed in `/usr/share/polkit-1/actions` as part of your application's installation script.

For more information, you can find a complete example of requiring PolicyKit and distributing policy files in the [Atom repository](https://github.com/atom/atom/pull/19412).
