## Releases

How to release

- update CHANGELOG.md
- update the version in package.json
- commit the changes with the version in the commit message
- tag the commit with the version `git tag <version>`
- push the commit and the tag to the remote repository `git push origin --tags`
- bun run build
- npm publish
- add a release to Github
