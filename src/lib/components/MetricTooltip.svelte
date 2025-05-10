<script lang="ts">
import {
	FloatingArrow,
	arrow,
	autoUpdate,
	flip,
	offset,
	useDismiss,
	useFloating,
	useHover,
	useInteractions,
	useRole,
} from "@skeletonlabs/floating-ui-svelte";
import { fade } from "svelte/transition";

// Accept direct props for label, icon, etc. instead of children
const { content, label, icon, iconClass, labelClass } = $props();
let open = $state(false);
let elemArrow: HTMLElement | null = $state(null);

const floating = useFloating({
	whileElementsMounted: autoUpdate,
	get open() {
		return open;
	},
	onOpenChange: (v) => {
		open = v;
	},
	placement: "top",
	get middleware() {
		return [offset(10), flip(), elemArrow && arrow({ element: elemArrow })];
	},
});

const role = useRole(floating.context, { role: "tooltip" });
const hover = useHover(floating.context, { move: false });
const dismiss = useDismiss(floating.context);
const interactions = useInteractions([role, hover, dismiss]);
</script>

<span
	bind:this={floating.elements.reference}
	{...interactions.getReferenceProps()}
	class="inline-flex cursor-help items-center gap-1"
>
	{#if icon}
		<span class={iconClass || "opacity-70 group-hover:opacity-100"}>{icon}</span>
	{/if}
	{#if label}
		<span class={labelClass || "text-gray-400"}>{label}</span>
	{/if}
</span>
{#if open}
	<div
		bind:this={floating.elements.floating}
		style={floating.floatingStyles}
		{...interactions.getFloatingProps()}
		class="floating popover-neutral z-50 px-2 py-1 text-xs rounded shadow-lg bg-gray-800 text-white"
		transition:fade={{ duration: 120 }}
	>
		{content}
		<FloatingArrow bind:ref={elemArrow} context={floating.context} fill="#575969" />
	</div>
{/if} 