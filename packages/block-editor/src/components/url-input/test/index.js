/**
 * External dependencies
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import URLInput from '../';

const fetchLinkSuggestions = jest.fn( () => Promise.resolve( [] ) );

function TestURLInput( props ) {
	const [ value, setValue ] = useState( '' );
	return (
		<URLInput
			value={ value }
			onChange={ setValue }
			__experimentalFetchLinkSuggestions={ fetchLinkSuggestions }
			{ ...props }
		/>
	);
}

// Advances past the 200ms suggestions debounce and flushes the
// fetch promise resolution.
async function advancePastDebounce() {
	await act( async () => {
		jest.advanceTimersByTime( 250 );
	} );
}

describe( 'URLInput', () => {
	beforeEach( () => {
		jest.useFakeTimers();
	} );

	afterEach( () => {
		fetchLinkSuggestions.mockClear();
		jest.clearAllTimers();
		jest.useRealTimers();
	} );

	it( 'should fetch suggestions when typing without an IME composition', async () => {
		render( <TestURLInput /> );

		const input = screen.getByRole( 'combobox' );
		fireEvent.change( input, { target: { value: 'Hello' } } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).toHaveBeenCalledTimes( 1 );
		expect( fetchLinkSuggestions ).toHaveBeenCalledWith(
			'Hello',
			expect.anything()
		);
	} );

	it( 'should not fetch suggestions while an IME composition is in progress', async () => {
		render( <TestURLInput /> );

		const input = screen.getByRole( 'combobox' );

		fireEvent.compositionStart( input );
		fireEvent.change( input, { target: { value: 'ほん' } } );
		fireEvent.change( input, { target: { value: 'ほんだ' } } );

		await advancePastDebounce();

		// The typed value still propagates while composing.
		expect( input ).toHaveValue( 'ほんだ' );
		// But no requests fire until the composition is confirmed.
		expect( fetchLinkSuggestions ).not.toHaveBeenCalled();

		fireEvent.compositionEnd( input, { data: 'ほんだ' } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).toHaveBeenCalledTimes( 1 );
		expect( fetchLinkSuggestions ).toHaveBeenCalledWith(
			'ほんだ',
			expect.anything()
		);
	} );

	it( 'should fetch suggestions once when the final change event arrives after the composition ends', async () => {
		render( <TestURLInput /> );

		const input = screen.getByRole( 'combobox' );

		fireEvent.compositionStart( input );
		fireEvent.change( input, { target: { value: 'ほん' } } );
		// Some browsers (e.g. Safari) emit the final input event after
		// `compositionend`.
		fireEvent.compositionEnd( input, { data: 'ほんだ' } );
		fireEvent.change( input, { target: { value: 'ほんだ' } } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).toHaveBeenCalledTimes( 1 );
		expect( fetchLinkSuggestions ).toHaveBeenCalledWith(
			'ほんだ',
			expect.anything()
		);
	} );

	it( 'should cancel an update scheduled before the composition started', async () => {
		render( <TestURLInput /> );

		const input = screen.getByRole( 'combobox' );

		// Schedule a debounced update, then start composing before it runs.
		fireEvent.change( input, { target: { value: 'He' } } );
		fireEvent.compositionStart( input );
		fireEvent.change( input, { target: { value: 'Heほ' } } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).not.toHaveBeenCalled();

		fireEvent.compositionEnd( input, { data: 'ほ' } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).toHaveBeenCalledTimes( 1 );
		expect( fetchLinkSuggestions ).toHaveBeenCalledWith(
			'Heほ',
			expect.anything()
		);
	} );

	it( 'should not fetch suggestions on composition end when suggestions are disabled', async () => {
		render( <TestURLInput disableSuggestions /> );

		const input = screen.getByRole( 'combobox' );

		fireEvent.compositionStart( input );
		fireEvent.change( input, { target: { value: 'ほん' } } );
		fireEvent.compositionEnd( input, { data: 'ほん' } );

		await advancePastDebounce();

		expect( fetchLinkSuggestions ).not.toHaveBeenCalled();
	} );
} );
