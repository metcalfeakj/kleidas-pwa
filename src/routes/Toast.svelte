<script>
	import { toast } from './toastStore';

	let message = '';
	let isVisible = false;

	// Subscribe to the toast store
	$: toast.subscribe(({ message: msg, visible }) => {
		message = msg;
		isVisible = visible;
	});
</script>

<style>
.toast {
	position: fixed;
	bottom: 20px;
	right: 20px;
	background-color: #007aff;
	color: white;
	padding: 10px 20px;
	border-radius: 5px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	opacity: 0;
	transform: translateY(20px);
	transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast.visible {
	opacity: 1;
	transform: translateY(0);
}
</style>

<div class="toast {isVisible ? 'visible' : ''}">
	{message}
</div>