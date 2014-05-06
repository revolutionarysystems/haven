Haven
=====

## A dependency manager for web applications

Haven is a dependency manager for front-end web applications, which will integrate nicely with other build tools. Haven comes with it's own Central Repository but can also take dependencies from Maven repositories, including the many webjar artifacts, the Bower repository, as well as any other private repositories that you point it at. Haven does not make any assumptions, it is completely agnostic to your choice of build tool, source code repository and code. A haven artifact can contain any type of asset, and any number of assets and it does not enforce any standards (eg. AMD, CommonJS)

## Installing Haven

Haven depends on NodeJS and NPM. Once these are installed run the following command to install Haven.

```sh
npm install -g haven
```

## Using Haven

### Configuring Haven

Haven requires a haven.json file in the root of your project. As a minimum this should include the project name and current version

```json
{
	"name": "my-artifact",
	"version": "0.1.0"
}
```

#### Configuring dependencies

```json
{
	...
	"dependencies": [
		{
			"name": "my-artifact",
			"version": "0.1.0"
		}
	]
}
```

##### Take only certain files from the artifact

```json
{
	...
	"dependencies": [
		{
			"name": "my-artifact",
			"version": "0.1.0",
			"includes": ["file1.js"]
		}
	]
}
```

##### Set the scope of a dependency

The default scope is "main", and only these dependencies are transient.

```json
{
	...
	"dependencies": [
		{
			"name": "my-artifact",
			"version": "0.1.0",
			"scope": "test"
		}
	]
}
```

#### Defining which files are included in your artifact

```json
{
	...
	"artifacts": [
		{
			"files": [
				"test.js"
			]
		}
	],
}
```

#### Defining multiple artifacts

The following example will deploy 2 artifacts "my-artifact" and "my-artifact-min" containing different files

```json
{
	...
	"artifacts": [
		{
			"files": [
				"test.js"
			]
		},
		{
			"id": "min",
			"files": [
				"test-min.js"
			]
		}
	]
}
```

#### Mapping files to your artifact

The following example will take src/test.js and put it in the artifact as my-artifact.js at the top level. It will also include the contents of the assets directory and include those files at the top level.

```json
{
	...
	"artifacts": [
		{
			"files": [
				"src/test.js": "my-artifact.js"
				"assets": "."
			]
		}
	],
}
```

#### Configuring extra repositories for dependencies

The default repository type is "haven", but haven can also support maven repositories.

```json
{
	...
	"repositories": {
		"dependencies": [
			{
				"url": "http://localhost:8080/haven-repository",
				"type": "haven"
			}
		]
	}
}
```

#### Configuring distribution repositories

```json
{
	...
	"repositories": {
		"distribution": [
			{
				"url": "http://localhost:8080/haven-repository"
			}
		]
	}
}
```

### The Haven command line

#### Updating dependencies

```sh
haven update
```

#### Installing artifacts into your local repository

```sh
haven install
```

#### Deploying artifacts to a remote repository

```sh
haven deploy
```

#### Cleaning haven dependencies

```sh
haven clean
```

#### Cleaning local repository

```sh
haven cleanCache
```