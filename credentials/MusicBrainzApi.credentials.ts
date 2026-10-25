import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

// MusicBrainz needs no key, only a User-Agent that identifies the application
// and a way to contact its maintainer. Read-only: no OAuth2.
export class MusicBrainzApi implements ICredentialType {
	name = 'musicBrainzApi';

	displayName = 'MusicBrainz API';

	documentationUrl = 'https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting#Provide_meaningful_User-Agent_strings';

	icon: Icon = {
		light: 'file:../nodes/MusicBrainz/musicbrainz.svg',
		dark: 'file:../nodes/MusicBrainz/musicbrainz.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'User-Agent',
			name: 'userAgent',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. MyN8nWorkflows/1.0 ( https://example.com/contact )',
			description:
				'Application name, version and a contact URL or email address. MusicBrainz blocks requests without a meaningful User-Agent.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'User-Agent': '={{$credentials.userAgent}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://musicbrainz.org/ws/2',
			url: '/artist/5b11f4ce-a62d-471e-81fc-a69a8278c7da',
			headers: { Accept: 'application/json' },
		},
	};
}
