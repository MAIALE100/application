# BASE access and maintenance roles

BASE uses four practical access levels.

## Workspace roles

### OWNER
The citizen who created a BASE.

- Full management of that BASE
- Invite members
- Promote or demote MANAGER
- Remove members and managers
- Rename the BASE
- Delete the BASE
- Create, edit, and delete managed content

### MANAGER
A member promoted by the OWNER.

- Invite new members
- Remove ordinary MEMBER accounts
- Create, edit, and delete shared memo content
- Create and configure stock items
- Create, edit, and delete tasks
- Create, edit, and delete custom calculators
- Void accounting entries
- Cannot promote/demote managers
- Cannot remove another manager
- Cannot rename or delete the BASE

### MEMBER
Normal invited member.

- View shared BASE data
- Adjust stock quantities
- Use custom calculators
- Add accounting entries
- Progress tasks assigned to their own citizenid
- Cannot create/delete managed structures unless promoted

## Global maintenance access

### ADMIN
ADMIN access is always active for players who have the configured ACE:

`flecity.base.admin`

Recommended server.cfg mapping:

```
add_ace group.admin flecity.base.admin allow
```

When ADMIN access is active, all BASE workspaces including personal MY SPACE workspaces are visible and manageable. Access to a workspace that the admin is not a member of is written to `flecity_base_access_audit`.

### WEAZEL SUPPORT
WEAZEL SUPPORT is intended for the app owner/maintainer.

Eligibility is controlled in `config.lua`:

- QBox job name defaults to `weazel`
- `job.isboss=true` is accepted
- A configured minimum grade can be used as a fallback
- The dedicated ACE `flecity.base.weazel_support` can also grant eligibility

WEAZEL SUPPORT is **OFF by default**. An eligible user must turn it ON from the BASE Members screen before other citizens' BASE workspaces become visible.

Support mode is session-only:
- reconnecting / character unload turns it OFF
- restarting the resource turns it OFF
- turning it OFF immediately returns the workspace list to normal membership-only visibility

Support mode ON/OFF and non-member workspace opens are written to `flecity_base_access_audit`.

Optional ACE example:

```
add_ace <principal> flecity.base.weazel_support allow
```

Do not grant WEAZEL SUPPORT to the whole server unless that is explicitly intended.
