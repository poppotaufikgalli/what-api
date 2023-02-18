<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>

<div id="app">
	 <p>List Client</p>
  	<ul v-if="show && listOfClient.length">
	    <li v-for="val, idx in listOfClient">
	      	<a :href="idx">{{ val }}</a>
	    </li>
  	</ul>
  	<p v-else>No Client</p>
	<a href="/connect">Create new</a>
</div>

<script>
  const { createApp } = Vue

  const API_URL = `http://localhost:3000`

  createApp({
    data() {
      	return {
        	listOfClient: null,
        	show: false,
      	}
    },

    created() {
    // fetch on init
	    this.fetchData()
	},

	watch: {
	    // re-fetch whenever currentBranch changes
	    //currentBranch: 'fetchData'
	},

	methods: {
	    async fetchData() {
	      	const url = `${API_URL}/getClient`
	      	var ret = await (await fetch(url)).json()
	      	if(ret.response.length){
	      		this.listOfClient = ret.response	
	      		this.show = true
	      	}

	      	console.log(this.listOfClient)
	    },
	}
  }).mount('#app')
</script>