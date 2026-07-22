import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const skillsDirectory = new URL( '.', import.meta.url );
const expectedSkills = new Set( [
	'design-system-code-review',
	'design-system-consumer-code-review',
	'design-system-contribution',
	'design-system-ui-composition',
] );

const directories = await readdir( skillsDirectory, { withFileTypes: true } );
const skillDirectories = directories
	.filter( ( entry ) => entry.isDirectory() )
	.map( ( entry ) => entry.name )
	.sort();

const errors = [];

for ( const name of skillDirectories ) {
	if ( ! expectedSkills.has( name ) ) {
		errors.push( `Unexpected skill directory: ${ name }` );
	}

	const skillPath = new URL( `${ name }/SKILL.md`, skillsDirectory );
	let source;

	try {
		source = await readFile( skillPath, 'utf8' );
	} catch {
		errors.push( `${ name }: missing SKILL.md` );
		continue;
	}

	const frontmatter = source.match( /^---\n([\s\S]*?)\n---\n/ );
	if ( ! frontmatter ) {
		errors.push( `${ name }: missing YAML frontmatter` );
		continue;
	}

	if ( ! frontmatter[ 1 ].match( new RegExp( `^name: ${ name }$`, 'm' ) ) ) {
		errors.push( `${ name }: frontmatter name must match its directory` );
	}
	if ( ! /^description: .+/m.test( frontmatter[ 1 ] ) ) {
		errors.push( `${ name }: missing frontmatter description` );
	}

	const links = source.matchAll( /\[[^\]]+\]\(([^)#]+)(?:#[^)]*)?\)/g );
	for ( const match of links ) {
		const target = match[ 1 ];
		if ( /^(?:https?:|mailto:)/.test( target ) ) {
			continue;
		}

		const resolvedPath = path.resolve(
			path.dirname( skillPath.pathname ),
			target
		);
		try {
			await stat( resolvedPath );
		} catch {
			errors.push( `${ name }: broken local link ${ target }` );
		}
	}
}

for ( const name of expectedSkills ) {
	if ( ! skillDirectories.includes( name ) ) {
		errors.push( `Missing skill directory: ${ name }` );
	}
}

if ( errors.length ) {
	process.stderr.write( `${ errors.join( '\n' ) }\n` );
	process.exitCode = 1;
} else {
	process.stdout.write(
		`Validated ${ skillDirectories.length } design-system skills.\n`
	);
}
